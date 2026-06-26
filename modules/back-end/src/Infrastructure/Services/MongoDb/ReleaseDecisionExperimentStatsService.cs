using Application.ExperimentStats;
using Domain.ReleaseDecisions;
using Domain.Targeting;
using System.Text.Json;
using MongoDB.Driver;

namespace Infrastructure.Services.MongoDb;

public class ReleaseDecisionExperimentStatsService(MongoDbClient mongoDb) : IExperimentStatsService
{
    public async Task<ExperimentStatsVm> QueryAsync(QueryExperimentStats request)
    {
        if (!string.IsNullOrWhiteSpace(request.AnalysisSamplingPlan))
        {
            return await QueryAnalysisSamplingPlanAsync(request);
        }

        if (!string.IsNullOrWhiteSpace(request.AllocationPlan))
        {
            return await QueryAllocationPlanAsync(request);
        }

        var start = ToUtcDateTime(request.StartTime)
                    ?? DateOnly.ParseExact(request.StartDate, "yyyy-MM-dd").ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);
        var end = ToUtcDateTime(request.EndTime)
                  ?? DateOnly.ParseExact(request.EndDate, "yyyy-MM-dd").AddDays(1).ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);
        var selectedVariants = GetSelectedVariants(request);
        var applySelectedVariantFilter = selectedVariants.Length > 0;
        var applyMatchedVariantScope = applySelectedVariantFilter &&
                                       selectedVariants.Length > 1 &&
                                       Math.Clamp(request.TrafficPercent ?? 100, 1, 100) < 100;

        var exposureDocs = await mongoDb.CollectionOf<ReleaseDecisionExposureEvent>()
            .Find(x =>
                x.EnvId == request.EnvId &&
                x.FlagKey == request.FlagKey &&
                x.ExposedAt >= start &&
                x.ExposedAt < end)
            .SortBy(x => x.ExposedAt)
            .ToListAsync();

        var scopedExposureDocs = applyMatchedVariantScope
            ? exposureDocs
            : ApplyTrafficScope(request, exposureDocs);

        var firstEvaluations = scopedExposureDocs
            .Where(x => !string.IsNullOrWhiteSpace(x.UserKey) && !string.IsNullOrWhiteSpace(x.VariationId))
            .GroupBy(x => x.UserKey)
            .Select(x => x.First())
            .Where(x => !applySelectedVariantFilter || selectedVariants.Contains(x.VariationId))
            .ToArray();

        if (applyMatchedVariantScope)
        {
            firstEvaluations = ApplyMatchedVariantScope(request, firstEvaluations, selectedVariants.Length).ToArray();
        }

        var firstEvaluationLookup = firstEvaluations.ToDictionary(x => x.UserKey);

        if (firstEvaluationLookup.Count == 0)
        {
            return BuildResponse(request, []);
        }

        var metricDocs = await mongoDb.CollectionOf<ReleaseDecisionMetricEvent>()
            .Find(x =>
                x.EnvId == request.EnvId &&
                x.EventName == request.MetricEvent &&
                x.OccurredAt >= start &&
                x.OccurredAt < end &&
                firstEvaluationLookup.Keys.Contains(x.UserKey))
            .ToListAsync();

        var userTotals = metricDocs
            .Where(x => firstEvaluationLookup.TryGetValue(x.UserKey, out var fe) && x.OccurredAt >= fe.ExposedAt)
            .GroupBy(x => x.UserKey)
            .ToDictionary(
                x => x.Key,
                x => new UserTotal
                {
                    Count = x.LongCount(),
                    Sum = x.Sum(y => y.NumericValue),
                    Average = x.Average(y => y.NumericValue)
                }
            );

        var rows = firstEvaluations
            .GroupBy(x => x.VariationId)
            .Select(group =>
            {
                var contributions = group.Select(fe => GetContribution(
                    request.MetricType,
                    request.MetricAgg,
                    userTotals.TryGetValue(fe.UserKey, out var total) ? total : null
                )).ToArray();
                var users = group.LongCount();
                var conversions = group.LongCount(fe =>
                    userTotals.TryGetValue(fe.UserKey, out var total) && total.Count > 0);
                var sumValue = contributions.Sum();

                return new ExperimentVariantStatsVm
                {
                    Variant = group.Key,
                    Users = users,
                    Conversions = conversions,
                    SumValue = sumValue,
                    SumSquares = contributions.Sum(x => x * x),
                    ConversionRate = users == 0 ? 0 : (double)conversions / users,
                    AvgValue = users == 0 ? 0 : sumValue / users
                };
            })
            .OrderBy(x => x.Variant)
            .ToArray();

        return BuildResponse(request, rows);
    }

    private async Task<ExperimentStatsVm> QueryAnalysisSamplingPlanAsync(QueryExperimentStats request)
    {
        var start = ToUtcDateTime(request.StartTime)
                    ?? DateOnly.ParseExact(request.StartDate, "yyyy-MM-dd").ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);
        var end = ToUtcDateTime(request.EndTime)
                  ?? DateOnly.ParseExact(request.EndDate, "yyyy-MM-dd").AddDays(1).ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);
        var plan = ParseSamplingPlan(request.AnalysisSamplingPlan)
            .Where(x => x.Role is "control" or "treatment")
            .ToDictionary(x => x.Variation, StringComparer.Ordinal);
        var assignmentUnitSelector = NormalizeAssignmentUnitSelector(request);
        var layerKey = NormalizeLayerKey(request);
        var layerTrafficPercent = Math.Clamp(request.LayerTrafficPercent ?? 100, 0.000001d, 100d);
        var applyLayer = !string.IsNullOrWhiteSpace(layerKey) && layerTrafficPercent < 100;
        var samplingScopeKey = (request.RunId?.ToString("N") ?? request.FlagKey) + ":";

        if (plan.Count == 0)
        {
            return BuildResponse(request, []);
        }

        var exposureDocs = await mongoDb.CollectionOf<ReleaseDecisionExposureEvent>()
            .Find(x =>
                x.EnvId == request.EnvId &&
                x.FlagKey == request.FlagKey &&
                x.ExposedAt >= start &&
                x.ExposedAt < end)
            .SortBy(x => x.ExposedAt)
            .ToListAsync();

        var assignments = exposureDocs
            .Select(x =>
            {
                if (string.IsNullOrWhiteSpace(x.UserKey) ||
                    string.IsNullOrWhiteSpace(x.VariationId) ||
                    !plan.TryGetValue(x.VariationId, out var planEntry))
                {
                    return null;
                }

                var assignmentUnit = GetAssignmentUnit(x.UserKey, x.Properties, assignmentUnitSelector);
                if (string.IsNullOrWhiteSpace(assignmentUnit))
                {
                    return null;
                }

                double? layerBucket = null;
                if (applyLayer)
                {
                    layerBucket = DispatchAlgorithm.RolloutOfKey($"{layerKey}{assignmentUnit}") * 100;
                    if (layerBucket >= layerTrafficPercent)
                    {
                        return null;
                    }
                }

                var samplingBucket = DispatchAlgorithm.RolloutOfKey($"{samplingScopeKey}{x.VariationId}:{assignmentUnit}") * 100;
                if (samplingBucket >= planEntry.IncludeRate)
                {
                    return null;
                }

                return new ComputedAssignment(
                    assignmentUnit,
                    x.UserKey,
                    x.VariationId,
                    x.VariationId,
                    planEntry.Role,
                    samplingBucket,
                    x.ExposedAt,
                    layerBucket,
                    samplingBucket);
            })
            .Where(x => x != null)
            .GroupBy(x => x!.AllocationKey)
            .Select(x => x.OrderBy(item => item!.FirstExposedAt).First()!)
            .ToArray();

        if (request.RunId.HasValue && assignments.Length > 0)
        {
            var now = DateTime.UtcNow;
            var writes = assignments.Select(item =>
                new ReplaceOneModel<ReleaseDecisionRunAssignment>(
                    Builders<ReleaseDecisionRunAssignment>.Filter.And(
                        Builders<ReleaseDecisionRunAssignment>.Filter.Eq(x => x.RunId, request.RunId.Value),
                        Builders<ReleaseDecisionRunAssignment>.Filter.Eq(x => x.AssignmentUnit, item.AllocationKey)),
                    new ReleaseDecisionRunAssignment
                    {
                        Id = Guid.NewGuid(),
                        RunId = request.RunId.Value,
                        EnvId = request.EnvId,
                        FlagKey = request.FlagKey,
                        AllocationKey = item.AllocationKey,
                        AssignmentUnit = item.AllocationKey,
                        UserKey = item.UserKey,
                        ExpectedVariationId = item.ExpectedVariationId,
                        ActualVariationId = item.ActualVariationId,
                        Role = item.Role,
                        AnalysisRole = item.Role,
                        Bucket = item.Bucket,
                        LayerBucket = item.LayerBucket,
                        SamplingBucket = item.SamplingBucket,
                        IncludedBySampling = true,
                        AssignedAt = now,
                        FirstExposedAt = item.FirstExposedAt,
                        CreatedAt = now,
                        UpdatedAt = now
                    })
                {
                    IsUpsert = true
                }).Cast<WriteModel<ReleaseDecisionRunAssignment>>().ToArray();

            await mongoDb.CollectionOf<ReleaseDecisionRunAssignment>().BulkWriteAsync(writes);
        }

        if (assignments.Length == 0)
        {
            return BuildResponse(request, []);
        }

        var assignmentUnits = assignments.Select(x => x.AllocationKey).ToHashSet(StringComparer.Ordinal);
        var assignmentLookup = assignments.ToDictionary(x => x.AllocationKey);
        var metricDocs = await mongoDb.CollectionOf<ReleaseDecisionMetricEvent>()
            .Find(x =>
                x.EnvId == request.EnvId &&
                x.EventName == request.MetricEvent &&
                x.OccurredAt >= start &&
                x.OccurredAt < end)
            .ToListAsync();

        var userTotals = metricDocs
            .Select(x => new
            {
                Metric = x,
                AssignmentUnit = GetAssignmentUnit(x.UserKey, x.Properties, assignmentUnitSelector)
            })
            .Where(x => !string.IsNullOrWhiteSpace(x.AssignmentUnit) &&
                        assignmentUnits.Contains(x.AssignmentUnit) &&
                        assignmentLookup.TryGetValue(x.AssignmentUnit, out var fe) &&
                        x.Metric.OccurredAt >= fe.FirstExposedAt)
            .GroupBy(x => x.AssignmentUnit)
            .ToDictionary(
                x => x.Key,
                x => new UserTotal
                {
                    Count = x.LongCount(),
                    Sum = x.Sum(y => y.Metric.NumericValue),
                    Average = x.Average(y => y.Metric.NumericValue)
                });

        var rows = assignments
            .GroupBy(x => x.ActualVariationId)
            .Select(group =>
            {
                var contributions = group.Select(fe => GetContribution(
                    request.MetricType,
                    request.MetricAgg,
                    userTotals.TryGetValue(fe.AllocationKey, out var total) ? total : null
                )).ToArray();
                var users = group.LongCount();
                var conversions = group.LongCount(fe =>
                    userTotals.TryGetValue(fe.AllocationKey, out var total) && total.Count > 0);
                var sumValue = contributions.Sum();

                return new ExperimentVariantStatsVm
                {
                    Variant = group.Key,
                    Users = users,
                    Conversions = conversions,
                    SumValue = sumValue,
                    SumSquares = contributions.Sum(x => x * x),
                    ConversionRate = users == 0 ? 0 : (double)conversions / users,
                    AvgValue = users == 0 ? 0 : sumValue / users
                };
            })
            .OrderBy(x => x.Variant)
            .ToArray();

        return BuildResponse(request, rows);
    }

    private async Task<ExperimentStatsVm> QueryAllocationPlanAsync(QueryExperimentStats request)
    {
        var start = ToUtcDateTime(request.StartTime)
                    ?? DateOnly.ParseExact(request.StartDate, "yyyy-MM-dd").ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);
        var end = ToUtcDateTime(request.EndTime)
                  ?? DateOnly.ParseExact(request.EndDate, "yyyy-MM-dd").AddDays(1).ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);
        var plan = ParseAllocationPlan(request.AllocationPlan);
        var layerKey = string.IsNullOrWhiteSpace(request.LayerKey) ? request.FlagKey : request.LayerKey.Trim();
        var allocationKeySelector = string.IsNullOrWhiteSpace(request.AllocationKeySelector)
            ? "user.keyId"
            : request.AllocationKeySelector.Trim();
        var sliceStart = Math.Clamp(request.SliceStart ?? 0, 0, 100);
        var sliceEnd = Math.Clamp(request.SliceEnd ?? 100, 0, 100);

        var exposureDocs = await mongoDb.CollectionOf<ReleaseDecisionExposureEvent>()
            .Find(x =>
                x.EnvId == request.EnvId &&
                x.FlagKey == request.FlagKey &&
                x.ExposedAt >= start &&
                x.ExposedAt < end)
            .SortBy(x => x.ExposedAt)
            .ToListAsync();

        var assignments = exposureDocs
            .Select(x =>
            {
                var allocationKey = GetAllocationKey(x.UserKey, x.Properties, allocationKeySelector);
                if (string.IsNullOrWhiteSpace(allocationKey))
                {
                    return null;
                }

                var bucket = DispatchAlgorithm.RolloutOfKey($"{layerKey}{allocationKey}") * 100;
                if (bucket < sliceStart || bucket >= sliceEnd)
                {
                    return null;
                }

                var planEntry = plan.FirstOrDefault(item => bucket >= item.Start && bucket < item.End);
                if (planEntry == null)
                {
                    return null;
                }

                var role = planEntry.Role != "analysis_arm"
                    ? planEntry.Role
                    : x.VariationId == planEntry.Variant
                        ? "analysis_arm"
                        : "mismatch";

                return new ComputedAssignment(
                    allocationKey,
                    x.UserKey,
                    planEntry.Variant,
                    x.VariationId,
                    role,
                    bucket,
                    x.ExposedAt,
                    null,
                    bucket);
            })
            .Where(x => x != null)
            .Where(x => x!.Role != "mismatch")
            .GroupBy(x => x!.AllocationKey)
            .Select(x => x.OrderBy(item => item!.FirstExposedAt).First()!)
            .ToArray();

        if (request.RunId.HasValue && assignments.Length > 0)
        {
            var now = DateTime.UtcNow;
            var writes = assignments.Select(item =>
                new ReplaceOneModel<ReleaseDecisionRunAssignment>(
                    Builders<ReleaseDecisionRunAssignment>.Filter.And(
                        Builders<ReleaseDecisionRunAssignment>.Filter.Eq(x => x.RunId, request.RunId.Value),
                        Builders<ReleaseDecisionRunAssignment>.Filter.Eq(x => x.AllocationKey, item.AllocationKey)),
                    new ReleaseDecisionRunAssignment
                    {
                        Id = Guid.NewGuid(),
                        RunId = request.RunId.Value,
                        EnvId = request.EnvId,
                        FlagKey = request.FlagKey,
                        AllocationKey = item.AllocationKey,
                        AssignmentUnit = item.AllocationKey,
                        UserKey = item.UserKey,
                        ExpectedVariationId = item.ExpectedVariationId,
                        ActualVariationId = item.ActualVariationId,
                        Role = item.Role,
                        AnalysisRole = item.Role,
                        Bucket = item.Bucket,
                        SamplingBucket = item.SamplingBucket,
                        IncludedBySampling = true,
                        AssignedAt = now,
                        FirstExposedAt = item.FirstExposedAt,
                        CreatedAt = now,
                        UpdatedAt = now
                    })
                {
                    IsUpsert = true
                }).Cast<WriteModel<ReleaseDecisionRunAssignment>>().ToArray();

            await mongoDb.CollectionOf<ReleaseDecisionRunAssignment>().BulkWriteAsync(writes);
        }

        var firstEvaluations = assignments
            .Where(x => x.Role == "analysis_arm")
            .ToArray();

        if (firstEvaluations.Length == 0)
        {
            return BuildResponse(request, []);
        }

        var allocationKeys = firstEvaluations.Select(x => x.AllocationKey).ToHashSet(StringComparer.Ordinal);
        var firstEvaluationLookup = firstEvaluations.ToDictionary(x => x.AllocationKey);
        var metricDocs = await mongoDb.CollectionOf<ReleaseDecisionMetricEvent>()
            .Find(x =>
                x.EnvId == request.EnvId &&
                x.EventName == request.MetricEvent &&
                x.OccurredAt >= start &&
                x.OccurredAt < end)
            .ToListAsync();

        var userTotals = metricDocs
            .Select(x => new
            {
                Metric = x,
                AllocationKey = GetAllocationKey(x.UserKey, x.Properties, allocationKeySelector)
            })
            .Where(x => allocationKeys.Contains(x.AllocationKey) &&
                        firstEvaluationLookup.TryGetValue(x.AllocationKey, out var fe) &&
                        x.Metric.OccurredAt >= fe.FirstExposedAt)
            .GroupBy(x => x.AllocationKey)
            .ToDictionary(
                x => x.Key,
                x => new UserTotal
                {
                    Count = x.LongCount(),
                    Sum = x.Sum(y => y.Metric.NumericValue),
                    Average = x.Average(y => y.Metric.NumericValue)
                });

        var rows = firstEvaluations
            .GroupBy(x => x.ExpectedVariationId)
            .Select(group =>
            {
                var contributions = group.Select(fe => GetContribution(
                    request.MetricType,
                    request.MetricAgg,
                    userTotals.TryGetValue(fe.AllocationKey, out var total) ? total : null
                )).ToArray();
                var users = group.LongCount();
                var conversions = group.LongCount(fe =>
                    userTotals.TryGetValue(fe.AllocationKey, out var total) && total.Count > 0);
                var sumValue = contributions.Sum();

                return new ExperimentVariantStatsVm
                {
                    Variant = group.Key,
                    Users = users,
                    Conversions = conversions,
                    SumValue = sumValue,
                    SumSquares = contributions.Sum(x => x * x),
                    ConversionRate = users == 0 ? 0 : (double)conversions / users,
                    AvgValue = users == 0 ? 0 : sumValue / users
                };
            })
            .OrderBy(x => x.Variant)
            .ToArray();

        return BuildResponse(request, rows);
    }

    private static ExperimentStatsVm BuildResponse(QueryExperimentStats request, IEnumerable<ExperimentVariantStatsVm> variants)
    {
        return new ExperimentStatsVm
        {
            EnvId = request.EnvId,
            FlagKey = request.FlagKey,
            MetricEvent = request.MetricEvent,
            Window = new ExperimentStatsWindowVm
            {
                Start = request.StartDate,
                End = request.EndDate
            },
            Variants = variants
        };
    }

    private static IEnumerable<ReleaseDecisionExposureEvent> ApplyTrafficScope(
        QueryExperimentStats request,
        IEnumerable<ReleaseDecisionExposureEvent> exposures)
    {
        var (enabled, start, end, scopeKey) = GetTrafficScope(request);
        if (!enabled)
        {
            return exposures;
        }

        return exposures.Where(x =>
        {
            var rollout = DispatchAlgorithm.RolloutOfKey($"{scopeKey}{x.UserKey}");
            return rollout >= start && rollout < end;
        });
    }

    private static (bool Enabled, double Start, double End, string ScopeKey) GetTrafficScope(QueryExperimentStats request)
    {
        var percent = Math.Clamp(request.TrafficPercent ?? 100, 1, 100);
        var offset = Math.Clamp(request.TrafficOffset ?? 0, 0, 99);
        var start = offset / 100d;
        var end = Math.Min(100, offset + percent) / 100d;
        var enabled = offset > 0 || percent < 100;
        var scopeKey = string.IsNullOrWhiteSpace(request.LayerId) ? request.FlagKey : request.LayerId.Trim();

        return (enabled, start, end, scopeKey);
    }

    private static IEnumerable<ReleaseDecisionExposureEvent> ApplyMatchedVariantScope(
        QueryExperimentStats request,
        ReleaseDecisionExposureEvent[] firstEvaluations,
        int selectedVariantCount)
    {
        var percent = Math.Clamp(request.TrafficPercent ?? 100, 1, 100);
        var targetPerVariant = Math.Max(
            1,
            (int)Math.Floor(firstEvaluations.Length * percent / 100d / selectedVariantCount));
        var groups = firstEvaluations
            .GroupBy(x => x.VariationId)
            .Select(x => new
            {
                Variant = x.Key,
                Users = x.ToArray()
            })
            .ToArray();

        if (groups.Length == 0)
        {
            return [];
        }

        var cap = groups.Min(x => Math.Min(x.Users.Length, targetPerVariant));
        var scopeKey = string.IsNullOrWhiteSpace(request.LayerId) ? request.FlagKey : request.LayerId.Trim();

        return groups.SelectMany(group => group.Users
            .OrderBy(x => DispatchAlgorithm.RolloutOfKey($"{scopeKey}{x.UserKey}"))
            .ThenBy(x => x.UserKey, StringComparer.Ordinal)
            .Take(cap));
    }

    private static string[] GetSelectedVariants(QueryExperimentStats request)
    {
        return new[] { request.ControlVariant }
            .Concat((request.TreatmentVariants ?? string.Empty)
                .Split('|', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
            .Where(x => !string.IsNullOrWhiteSpace(x))
            .Distinct(StringComparer.Ordinal)
            .ToArray();
    }

    private static double GetContribution(string metricType, string metricAgg, UserTotal? userTotal)
    {
        var total = userTotal ?? new UserTotal();
        var normalizedAgg = metricType == "binary" ? "once" : metricAgg;

        return normalizedAgg switch
        {
            "once" => total.Count > 0 ? 1 : 0,
            "count" => total.Count,
            "sum" => total.Sum,
            "average" => total.Average,
            _ => throw new ArgumentException($"Unsupported metric aggregation: {metricAgg}", nameof(metricAgg))
        };
    }

    private sealed record UserTotal
    {
        public long Count { get; init; }
        public double Sum { get; init; }
        public double Average { get; init; }
    }

    private static AllocationPlanEntry[] ParseAllocationPlan(string allocationPlan)
    {
        return JsonSerializer.Deserialize<AllocationPlanEntry[]>(allocationPlan, new JsonSerializerOptions
        {
            PropertyNameCaseInsensitive = true
        }) ?? [];
    }

    private static SamplingPlanEntry[] ParseSamplingPlan(string samplingPlan)
    {
        return JsonSerializer.Deserialize<SamplingPlanEntry[]>(samplingPlan, new JsonSerializerOptions
        {
            PropertyNameCaseInsensitive = true
        })?
        .Where(x => !string.IsNullOrWhiteSpace(x.Variation))
        .Select(x => x with
        {
            Role = NormalizeRole(x.Role),
            IncludeRate = Math.Clamp(x.IncludeRate, 0, 100)
        })
        .ToArray() ?? [];
    }

    private static string NormalizeRole(string role)
    {
        var normalized = (role ?? string.Empty).Trim().ToLowerInvariant();
        return normalized is "control" or "treatment" or "holdout" or "exclude"
            ? normalized
            : "treatment";
    }

    private static string GetAllocationKey(string userKey, string properties, string selector)
    {
        if (string.IsNullOrWhiteSpace(selector) ||
            selector is "user.keyId" or "user.key" or "keyId")
        {
            return userKey;
        }

        if (string.IsNullOrWhiteSpace(properties))
        {
            return userKey;
        }

        try
        {
            using var document = JsonDocument.Parse(properties);
            return document.RootElement.TryGetProperty(selector, out var value)
                ? value.ToString()
                : userKey;
        }
        catch
        {
            return userKey;
        }
    }

    private static string GetAssignmentUnit(string userKey, string properties, string selector)
    {
        if (string.IsNullOrWhiteSpace(selector) ||
            selector is "user.keyId" or "user.key" or "keyId")
        {
            return userKey;
        }

        if (string.IsNullOrWhiteSpace(properties))
        {
            return null;
        }

        try
        {
            using var document = JsonDocument.Parse(properties);
            return document.RootElement.TryGetProperty(selector, out var value)
                ? value.ToString()
                : null;
        }
        catch
        {
            return null;
        }
    }

    private static string NormalizeAssignmentUnitSelector(QueryExperimentStats request)
    {
        return string.IsNullOrWhiteSpace(request.AssignmentUnitSelector)
            ? string.IsNullOrWhiteSpace(request.AllocationKeySelector)
                ? "user.keyId"
                : request.AllocationKeySelector.Trim()
            : request.AssignmentUnitSelector.Trim();
    }

    private static string NormalizeLayerKey(QueryExperimentStats request)
    {
        return string.IsNullOrWhiteSpace(request.LayerKey)
            ? string.IsNullOrWhiteSpace(request.LayerId)
                ? null
                : request.LayerId.Trim()
            : request.LayerKey.Trim();
    }

    private static DateTime? ToUtcDateTime(DateTime? value)
    {
        return value?.ToUniversalTime();
    }

    private sealed record AllocationPlanEntry(
        string Variant,
        string Role,
        double Start,
        double End);

    private sealed record SamplingPlanEntry(
        string Variation,
        string Role,
        double IncludeRate,
        string Label);

    private sealed record ComputedAssignment(
        string AllocationKey,
        string UserKey,
        string ExpectedVariationId,
        string ActualVariationId,
        string Role,
        double Bucket,
        DateTime FirstExposedAt,
        double? LayerBucket,
        double? SamplingBucket);
}
