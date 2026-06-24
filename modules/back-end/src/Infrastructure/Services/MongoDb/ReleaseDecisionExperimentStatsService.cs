using Application.ExperimentStats;
using Domain.ReleaseDecisions;
using Domain.Targeting;
using MongoDB.Driver;

namespace Infrastructure.Services.MongoDb;

public class ReleaseDecisionExperimentStatsService(MongoDbClient mongoDb) : IExperimentStatsService
{
    public async Task<ExperimentStatsVm> QueryAsync(QueryExperimentStats request)
    {
        var start = DateOnly.ParseExact(request.StartDate, "yyyy-MM-dd").ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);
        var end = DateOnly.ParseExact(request.EndDate, "yyyy-MM-dd").AddDays(1).ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);

        var exposureDocs = await mongoDb.CollectionOf<ReleaseDecisionExposureEvent>()
            .Find(x =>
                x.EnvId == request.EnvId &&
                x.FlagKey == request.FlagKey &&
                x.ExposedAt >= start &&
                x.ExposedAt < end)
            .SortBy(x => x.ExposedAt)
            .ToListAsync();

        var scopedExposureDocs = ApplyTrafficScope(request, exposureDocs);

        var firstEvaluations = scopedExposureDocs
            .Where(x => !string.IsNullOrWhiteSpace(x.UserKey) && !string.IsNullOrWhiteSpace(x.VariationId))
            .GroupBy(x => x.UserKey)
            .Select(x => x.First())
            .ToDictionary(x => x.UserKey);

        if (firstEvaluations.Count == 0)
        {
            return BuildResponse(request, []);
        }

        var metricDocs = await mongoDb.CollectionOf<ReleaseDecisionMetricEvent>()
            .Find(x =>
                x.EnvId == request.EnvId &&
                x.EventName == request.MetricEvent &&
                x.OccurredAt >= start &&
                x.OccurredAt < end &&
                firstEvaluations.Keys.Contains(x.UserKey))
            .ToListAsync();

        var userTotals = metricDocs
            .Where(x => firstEvaluations.TryGetValue(x.UserKey, out var fe) && x.OccurredAt >= fe.ExposedAt)
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

        var rows = firstEvaluations.Values
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
            var rollout = DispatchAlgorithm.RolloutOfKey($"{scopeKey}:{x.UserKey}");
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
}
