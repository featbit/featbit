using Application.Bases.Models;
using Application.Bases.Exceptions;
using Application.ExperimentStats;
using Application.ReleaseDecisions;
using Application.Services;
using Domain.FeatureFlags;
using Domain.ReleaseDecisions;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;

namespace Infrastructure.Services.EntityFrameworkCore;

public class ReleaseDecisionExperimentService(
    AppDbContext dbContext,
    IExperimentStatsService statsService,
    IFeatureFlagService featureFlagService)
    : IReleaseDecisionExperimentService
{
    private const double GuardrailHealthyHarmProbability = 0.01;
    private const double GuardrailAlarmHarmProbability = 0.95;

    public async Task<ReleaseDecisionExperimentVm> CreateAsync(ReleaseDecisionExperiment experiment)
    {
        await dbContext.Set<ReleaseDecisionExperiment>().AddAsync(experiment);
        await dbContext.Set<ReleaseDecisionActivity>().AddAsync(new ReleaseDecisionActivity
        {
            Id = Guid.NewGuid(),
            ExperimentId = experiment.Id,
            Type = "stage_change",
            Title = "Experiment created",
            Detail = $"Release decision experiment \"{experiment.Name}\" created. Stage: hypothesis",
            CreatedAt = experiment.CreatedAt
        });
        await dbContext.SaveChangesAsync();

        return ToVm(experiment);
    }

    public async Task<ReleaseDecisionExperimentDetailVm> GetAsync(Guid envId, Guid id)
    {
        var experiment = await dbContext.Set<ReleaseDecisionExperiment>()
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == id && x.FeatBitEnvId == envId);

        if (experiment == null)
        {
            throw new EntityNotFoundException(nameof(ReleaseDecisionExperiment), $"{envId}-{id}");
        }

        await LoadExperimentChildrenAsync(experiment);
        await AlignRunsForReadAsync(envId, experiment);
        return ToDetailVm(experiment);
    }

    public async Task<Guid> GetEnvIdAsync(Guid id)
    {
        var envId = await dbContext.Set<ReleaseDecisionExperiment>()
            .AsNoTracking()
            .Where(x => x.Id == id)
            .Select(x => x.FeatBitEnvId)
            .FirstOrDefaultAsync();

        if (!envId.HasValue)
        {
            throw new EntityNotFoundException(nameof(ReleaseDecisionExperiment), id.ToString());
        }

        return envId.Value;
    }

    public async Task DeleteAsync(Guid envId, Guid id)
    {
        var experiment = await dbContext.Set<ReleaseDecisionExperiment>()
            .AsTracking()
            .FirstOrDefaultAsync(x => x.Id == id && x.FeatBitEnvId == envId);

        if (experiment == null)
        {
            throw new EntityNotFoundException(nameof(ReleaseDecisionExperiment), $"{envId}-{id}");
        }

        await dbContext.Set<ReleaseDecisionExperimentRun>()
            .Where(x => x.ExperimentId == id)
            .ExecuteDeleteAsync();
        await dbContext.Set<ReleaseDecisionActivity>()
            .Where(x => x.ExperimentId == id)
            .ExecuteDeleteAsync();

        dbContext.Set<ReleaseDecisionExperiment>().Remove(experiment);
        await dbContext.SaveChangesAsync();
    }

    public async Task<ReleaseDecisionExperimentDetailVm> UpdateAsync(
        Guid envId,
        Guid id,
        ReleaseDecisionExperimentUpdate update)
    {
        update ??= new ReleaseDecisionExperimentUpdate();

        var experiment = await dbContext.Set<ReleaseDecisionExperiment>()
            .AsTracking()
            .FirstOrDefaultAsync(x => x.Id == id && x.FeatBitEnvId == envId);

        if (experiment == null)
        {
            throw new EntityNotFoundException(nameof(ReleaseDecisionExperiment), $"{envId}-{id}");
        }

        var originalStage = experiment.Stage;

        ApplyUpdate(experiment, update);
        experiment.UpdatedAt = DateTime.UtcNow;

        await dbContext.Set<ReleaseDecisionActivity>().AddAsync(new ReleaseDecisionActivity
        {
            Id = Guid.NewGuid(),
            ExperimentId = experiment.Id,
            Type = originalStage == experiment.Stage ? "state_update" : "stage_change",
            Title = originalStage == experiment.Stage
                ? "Decision state updated"
                : $"Stage changed to {experiment.Stage}",
            CreatedAt = experiment.UpdatedAt
        });

        await dbContext.SaveChangesAsync();
        return await GetAsync(envId, id);
    }

    public async Task<ReleaseDecisionExperimentDetailVm> UpdateStageAsync(
        Guid envId,
        Guid id,
        string stage)
    {
        var experiment = await dbContext.Set<ReleaseDecisionExperiment>()
            .AsTracking()
            .FirstOrDefaultAsync(x => x.Id == id && x.FeatBitEnvId == envId);

        if (experiment == null)
        {
            throw new EntityNotFoundException(nameof(ReleaseDecisionExperiment), $"{envId}-{id}");
        }

        experiment.Stage = Normalize(stage, experiment.Stage);
        experiment.UpdatedAt = DateTime.UtcNow;

        await dbContext.Set<ReleaseDecisionActivity>().AddAsync(new ReleaseDecisionActivity
        {
            Id = Guid.NewGuid(),
            ExperimentId = experiment.Id,
            Type = "stage_change",
            Title = $"Stage changed to {experiment.Stage}",
            CreatedAt = experiment.UpdatedAt
        });

        await dbContext.SaveChangesAsync();
        return await GetAsync(envId, id);
    }

    public async Task<ReleaseDecisionExperimentDetailVm> UpdateMetricsAsync(
        Guid envId,
        Guid id,
        ReleaseDecisionMetricsUpdate update)
    {
        update ??= new ReleaseDecisionMetricsUpdate();

        var experiment = await GetTrackedExperimentAsync(envId, id);
        var primaryMetric = BuildPrimaryMetricJson(update);
        var guardrails = Normalize(update.Guardrails);

        experiment.PrimaryMetric = primaryMetric;
        experiment.Guardrails = guardrails;
        experiment.UpdatedAt = DateTime.UtcNow;

        var latestRun = await dbContext.Set<ReleaseDecisionExperimentRun>()
            .AsTracking()
            .Where(x => x.ExperimentId == id)
            .OrderByDescending(x => x.CreatedAt)
            .FirstOrDefaultAsync();

        if (latestRun != null)
        {
            latestRun.PrimaryMetricEvent = Normalize(update.MetricEvent);
            latestRun.MetricDescription = Normalize(update.MetricDescription);
            latestRun.PrimaryMetricType = NormalizeMetricType(update.MetricType);
            latestRun.PrimaryMetricAgg = NormalizeMetricAgg(update.MetricAgg);
            latestRun.GuardrailEvents = BuildGuardrailEventsJson(guardrails);
            latestRun.UpdatedAt = experiment.UpdatedAt;
        }

        await AddActivityAsync(id, "note", "Experiment metrics updated", null, experiment.UpdatedAt);
        await dbContext.SaveChangesAsync();

        return await GetAsync(envId, id);
    }

    public async Task<ReleaseDecisionExperimentDetailVm> CreateRunAsync(Guid envId, Guid id)
    {
        var experiment = await GetTrackedExperimentAsync(envId, id);

        var existingRuns = await dbContext.Set<ReleaseDecisionExperimentRun>()
            .Where(x => x.ExperimentId == id)
            .OrderBy(x => x.CreatedAt)
            .ToListAsync();

        var previous = existingRuns.LastOrDefault();
        var usedSlugs = existingRuns.Select(x => x.Slug).ToHashSet(StringComparer.OrdinalIgnoreCase);
        var number = existingRuns.Count + 1;
        var slug = $"run-{number}";
        while (usedSlugs.Contains(slug))
        {
            number++;
            slug = $"run-{number}";
        }

        var now = DateTime.UtcNow;
        var run = new ReleaseDecisionExperimentRun
        {
            Id = Guid.NewGuid(),
            ExperimentId = id,
            Slug = slug,
            Status = "draft",
            Method = previous?.Method ?? "bayesian_ab",
            MethodReason = previous?.MethodReason,
            PrimaryMetricEvent = previous?.PrimaryMetricEvent,
            MetricDescription = previous?.MetricDescription,
            PrimaryMetricType = previous?.PrimaryMetricType ?? "binary",
            PrimaryMetricAgg = previous?.PrimaryMetricAgg ?? "once",
            GuardrailEvents = previous?.GuardrailEvents,
            GuardrailDescriptions = previous?.GuardrailDescriptions,
            ControlVariant = previous?.ControlVariant,
            TreatmentVariant = previous?.TreatmentVariant,
            TrafficPercent = previous?.TrafficPercent ?? 100,
            TrafficOffset = previous?.TrafficOffset ?? 0,
            LayerId = previous?.LayerId,
            AudienceFilters = previous?.AudienceFilters,
            MinimumSample = previous?.MinimumSample,
            PriorProper = previous?.PriorProper ?? false,
            PriorMean = previous?.PriorMean,
            PriorStddev = previous?.PriorStddev,
            CreatedAt = now,
            UpdatedAt = now
        };
        HydrateRunMetricConfig(run, experiment);
        await AlignRunVariantsAsync(envId, experiment, run, inferMissing: true);

        await dbContext.Set<ReleaseDecisionExperimentRun>().AddAsync(run);
        await AddActivityAsync(
            id,
            "note",
            $"New experiment run created: {slug}",
            previous == null ? "Empty template" : $"Copied config from {previous.Slug}",
            now);

        await dbContext.SaveChangesAsync();
        return await GetAsync(envId, id);
    }

    public async Task<ReleaseDecisionExperimentDetailVm> DeleteRunAsync(Guid envId, Guid id, Guid runId)
    {
        await EnsureExperimentExistsAsync(envId, id);

        var run = await dbContext.Set<ReleaseDecisionExperimentRun>()
            .FirstOrDefaultAsync(x => x.Id == runId && x.ExperimentId == id);

        if (run == null)
        {
            throw new EntityNotFoundException(nameof(ReleaseDecisionExperimentRun), $"{id}-{runId}");
        }

        dbContext.Set<ReleaseDecisionExperimentRun>().Remove(run);
        await AddActivityAsync(id, "note", $"Experiment run deleted: {run.Slug}");
        await dbContext.SaveChangesAsync();

        return await GetAsync(envId, id);
    }

    public async Task<ReleaseDecisionExperimentDetailVm> UpdateRunAsync(
        Guid envId,
        Guid id,
        Guid runId,
        ReleaseDecisionExperimentRunUpdate update)
    {
        update ??= new ReleaseDecisionExperimentRunUpdate();
        var experiment = await GetTrackedExperimentAsync(envId, id);

        var run = await GetTrackedRunAsync(id, runId);
        ApplyRunUpdate(run, update);
        await AlignRunVariantsAsync(envId, experiment, run, inferMissing: false);
        run.UpdatedAt = DateTime.UtcNow;

        await AddActivityAsync(id, "note", $"Experiment run updated: {run.Slug}", null, run.UpdatedAt);
        await dbContext.SaveChangesAsync();

        return await GetAsync(envId, id);
    }

    public async Task<ReleaseDecisionExperimentDetailVm> UpdateRunAudienceAsync(
        Guid envId,
        Guid id,
        Guid runId,
        ReleaseDecisionExperimentRunAudienceUpdate update)
    {
        update ??= new ReleaseDecisionExperimentRunAudienceUpdate();
        await EnsureExperimentExistsAsync(envId, id);

        var run = await GetTrackedRunAsync(id, runId);
        run.TrafficPercent = Math.Clamp(update.TrafficPercent ?? 100, 1, 100);
        run.TrafficOffset = Math.Clamp(update.TrafficOffset ?? 0, 0, 99);
        run.LayerId = Normalize(update.LayerId);
        run.AudienceFilters = Normalize(update.AudienceFilters);
        run.Method = update.Method == "bandit" ? "bandit" : "bayesian_ab";
        run.UpdatedAt = DateTime.UtcNow;

        await AddActivityAsync(id, "note", "Experiment run audience & traffic updated", null, run.UpdatedAt);
        await dbContext.SaveChangesAsync();

        return await GetAsync(envId, id);
    }

    public async Task<ReleaseDecisionExperimentDetailVm> UpdateRunObservationWindowAsync(
        Guid envId,
        Guid id,
        Guid runId,
        ReleaseDecisionExperimentRunObservationWindowUpdate update)
    {
        update ??= new ReleaseDecisionExperimentRunObservationWindowUpdate();
        await EnsureExperimentExistsAsync(envId, id);

        var run = await GetTrackedRunAsync(id, runId);
        run.ObservationStart = update.ObservationStart;
        run.ObservationEnd = update.ObservationEnd;
        run.UpdatedAt = DateTime.UtcNow;

        await AddActivityAsync(
            id,
            "note",
            "Observation window updated",
            update.ObservationStart.HasValue || update.ObservationEnd.HasValue
                ? $"From {update.ObservationStart?.ToString("u") ?? "—"} to {update.ObservationEnd?.ToString("u") ?? "—"}"
                : "Cleared",
            run.UpdatedAt);
        await dbContext.SaveChangesAsync();

        return await GetAsync(envId, id);
    }

    public async Task<ReleaseDecisionExperimentDetailVm> AnalyzeRunAsync(
        Guid envId,
        Guid id,
        Guid runId,
        ReleaseDecisionExperimentRunAnalyzeRequest request)
    {
        request ??= new ReleaseDecisionExperimentRunAnalyzeRequest();
        var experiment = await GetTrackedExperimentAsync(envId, id);
        var run = await GetTrackedRunAsync(id, runId);
        HydrateRunMetricConfig(run, experiment);
        await AlignRunVariantsAsync(envId, experiment, run, inferMissing: true);
        var primaryMetricEvent = Normalize(run.PrimaryMetricEvent);

        if (string.IsNullOrWhiteSpace(experiment.FlagKey))
        {
            throw new InvalidOperationException("Feature flag key is required before analysis.");
        }

        if (string.IsNullOrWhiteSpace(primaryMetricEvent))
        {
            throw new InvalidOperationException("Primary metric event is required before analysis.");
        }

        var now = DateTime.UtcNow;
        var start = run.ObservationStart ?? now.AddDays(-30);
        var end = run.ObservationEnd ?? now;
        var startDate = DateOnly.FromDateTime(start).ToString("yyyy-MM-dd");
        var endDate = DateOnly.FromDateTime(end).ToString("yyyy-MM-dd");
        var metricType = NormalizeMetricType(run.PrimaryMetricType);
        var metricAgg = NormalizeMetricAgg(run.PrimaryMetricAgg);

        var stats = await statsService.QueryAsync(new QueryExperimentStats
        {
            EnvId = envId,
            FlagKey = experiment.FlagKey,
            MetricEvent = primaryMetricEvent,
            StartDate = startDate,
            EndDate = endDate,
            MetricType = metricType,
            MetricAgg = metricAgg
        });

        var variants = stats.Variants?.ToArray() ?? [];
        var primaryMetricData = BuildMetricData(metricType, variants);
        if (TryReadPrimaryMetric(experiment.PrimaryMetric, out var primary) &&
            IsDecreaseGood(primary.ExpectedDirection))
        {
            primaryMetricData["inverse"] = true;
        }

        var metrics = new Dictionary<string, Dictionary<string, object>>
        {
            [primaryMetricEvent] = primaryMetricData
        };

        var guardrails = ParseGuardrailDefinitions(run.GuardrailEvents);
        foreach (var guardrail in guardrails)
        {
            var guardrailStats = await statsService.QueryAsync(new QueryExperimentStats
            {
                EnvId = envId,
                FlagKey = experiment.FlagKey,
                MetricEvent = guardrail.Event,
                StartDate = startDate,
                EndDate = endDate,
                MetricType = guardrail.MetricType,
                MetricAgg = guardrail.MetricAgg
            });

            var guardrailData = BuildMetricData(
                guardrail.MetricType,
                guardrailStats.Variants?.ToArray() ?? []);

            if (guardrail.Inverse)
            {
                guardrailData["inverse"] = true;
            }

            metrics[guardrail.Event] = guardrailData;
        }

        var inputData = BuildInputDataJson(metrics);
        var control = Normalize(run.ControlVariant) ?? "control";
        var treatments = SplitTreatments(run.TreatmentVariant);
        var (analysisControl, analysisTreatments) = ResolveAnalysisVariantKeys(
            experiment.Variants,
            primaryMetricData,
            control,
            treatments);
        var analysisResult = run.Method == "bandit"
            ? BuildBanditAnalysisJson(run, primaryMetricEvent, metrics, analysisControl, analysisTreatments)
            : BuildBayesianAnalysisJson(run, experiment.Name ?? id.ToString(), primaryMetricEvent, metricAgg, metrics, guardrails, analysisControl, analysisTreatments);

        run.InputData = inputData;
        run.AnalysisResult = analysisResult;
        run.Status = variants.Length == 0 || variants.All(x => x.Users == 0)
            ? "collecting"
            : "analyzing";
        run.UpdatedAt = DateTime.UtcNow;

        await AddActivityAsync(
            id,
            "note",
            "Experiment run analyzed from FeatBit stats",
            $"{experiment.FlagKey} · {primaryMetricEvent} · {startDate} to {endDate}",
            run.UpdatedAt);

        await dbContext.SaveChangesAsync();
        return await GetAsync(envId, id);
    }

    public async Task<PagedResult<ReleaseDecisionExperimentVm>> GetListAsync(
        Guid envId,
        ReleaseDecisionExperimentFilter filter)
    {
        filter ??= new ReleaseDecisionExperimentFilter();

        var query = dbContext.Set<ReleaseDecisionExperiment>()
            .AsNoTracking()
            .Where(x => x.FeatBitEnvId == envId);

        if (!string.IsNullOrWhiteSpace(filter.Name))
        {
            query = query.Where(x => x.Name.Contains(filter.Name));
        }

        if (!string.IsNullOrWhiteSpace(filter.Stage))
        {
            query = query.Where(x => x.Stage == filter.Stage);
        }

        if (!string.IsNullOrWhiteSpace(filter.FlagKey))
        {
            query = query.Where(x => x.FlagKey.Contains(filter.FlagKey));
        }

        var totalCount = await query.LongCountAsync();
        var pageSize = filter.PageSize <= 0 ? 10 : filter.PageSize;
        var pageIndex = Math.Max(filter.PageIndex, 0);

        var experiments = await query
            .OrderByDescending(x => x.UpdatedAt)
            .ThenByDescending(x => x.CreatedAt)
            .Skip(pageIndex * pageSize)
            .Take(pageSize)
            .ToListAsync();

        var runLookup = await BuildRunLookupAsync(experiments.Select(x => x.Id).ToArray());
        var items = experiments.Select(experiment => ToVm(experiment, runLookup)).ToArray();

        return new PagedResult<ReleaseDecisionExperimentVm>(totalCount, items);
    }

    private async Task<Dictionary<Guid, string[]>> BuildRunLookupAsync(Guid[] experimentIds)
    {
        if (experimentIds.Length == 0)
        {
            return new Dictionary<Guid, string[]>();
        }

        return (await dbContext.Set<ReleaseDecisionExperimentRun>()
                .AsNoTracking()
                .Where(x => experimentIds.Contains(x.ExperimentId))
                .Select(x => new { x.ExperimentId, x.Method })
                .ToListAsync())
            .GroupBy(x => x.ExperimentId)
            .ToDictionary(x => x.Key, x => x.Select(run => run.Method).ToArray());
    }

    private static ReleaseDecisionExperimentVm ToVm(
        ReleaseDecisionExperiment experiment,
        IReadOnlyDictionary<Guid, string[]>? runLookup = null)
    {
        var methods = runLookup != null && runLookup.TryGetValue(experiment.Id, out var lookupMethods)
            ? lookupMethods
            : experiment.ExperimentRuns.Select(x => x.Method).ToArray();

        return new ReleaseDecisionExperimentVm
        {
            Id = experiment.Id,
            Name = experiment.Name,
            Description = experiment.Description,
            Stage = experiment.Stage,
            FlagKey = experiment.FlagKey,
            FeatBitProjectKey = experiment.FeatBitProjectKey,
            FeatBitEnvId = experiment.FeatBitEnvId,
            RunCount = methods.Length,
            RunMethodSummary = BuildRunMethodSummary(methods),
            CreatedAt = experiment.CreatedAt,
            UpdatedAt = experiment.UpdatedAt
        };
    }

    private static string BuildRunMethodSummary(IEnumerable<string> methods)
    {
        var normalized = methods.ToArray();
        if (normalized.Length == 0)
        {
            return "No runs";
        }

        var hasBandit = normalized.Any(method => method == "bandit");
        var hasBayesian = normalized.Any(method => method != "bandit");

        return (hasBayesian, hasBandit) switch
        {
            (true, true) => "Bayesian + Bandit arms",
            (false, true) => "Bandit arms",
            _ => "Bayesian"
        };
    }

    private async Task LoadExperimentChildrenAsync(ReleaseDecisionExperiment experiment)
    {
        experiment.ExperimentRuns = await dbContext.Set<ReleaseDecisionExperimentRun>()
            .AsNoTracking()
            .Where(x => x.ExperimentId == experiment.Id)
            .ToListAsync();
        experiment.Activities = await dbContext.Set<ReleaseDecisionActivity>()
            .AsNoTracking()
            .Where(x => x.ExperimentId == experiment.Id)
            .ToListAsync();
    }

    private async Task AlignRunsForReadAsync(Guid envId, ReleaseDecisionExperiment experiment)
    {
        var flag = await TryGetBoundFeatureFlagAsync(envId, experiment);
        if (flag == null)
        {
            return;
        }

        experiment.Variants = BuildFeatureFlagVariantsJson(flag);
        foreach (var run in experiment.ExperimentRuns)
        {
            AlignRunVariants(run, flag, inferMissing: false);
        }
    }

    private async Task AlignRunVariantsAsync(
        Guid envId,
        ReleaseDecisionExperiment experiment,
        ReleaseDecisionExperimentRun run,
        bool inferMissing)
    {
        var flag = await TryGetBoundFeatureFlagAsync(envId, experiment);
        if (flag == null)
        {
            return;
        }

        experiment.Variants = BuildFeatureFlagVariantsJson(flag);
        AlignRunVariants(run, flag, inferMissing);
    }

    private async Task<FeatureFlag?> TryGetBoundFeatureFlagAsync(
        Guid envId,
        ReleaseDecisionExperiment experiment)
    {
        var flagKey = Normalize(experiment.FlagKey);
        if (string.IsNullOrWhiteSpace(flagKey))
        {
            return null;
        }

        try
        {
            return await featureFlagService.GetAsync(envId, flagKey);
        }
        catch (EntityNotFoundException)
        {
            return null;
        }
    }

    private static void AlignRunVariants(
        ReleaseDecisionExperimentRun run,
        FeatureFlag flag,
        bool inferMissing)
    {
        var variations = flag.Variations?
            .Where(x => !string.IsNullOrWhiteSpace(x.Id))
            .ToArray() ?? [];
        if (variations.Length == 0)
        {
            return;
        }

        if (inferMissing &&
            TryResolveNamedControlAndTreatments(variations, out var namedControl, out var namedTreatments))
        {
            run.ControlVariant = namedControl;
            run.TreatmentVariant = string.Join("|", namedTreatments);
            return;
        }

        var control = ResolveVariantId(run.ControlVariant, variations);
        if (string.IsNullOrWhiteSpace(control) && inferMissing)
        {
            control = PickControlVariationId(flag, variations);
        }

        var treatments = ResolveTreatmentVariantIds(run.TreatmentVariant, variations)
            .Where(x => !string.IsNullOrWhiteSpace(x))
            .Where(x => string.IsNullOrWhiteSpace(control) || !VariantTokenEquals(x, control))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToArray();

        if (treatments.Length == 0 && inferMissing && !string.IsNullOrWhiteSpace(control))
        {
            treatments = variations
                .Where(x => !VariantTokenEquals(x.Id, control))
                .OrderBy(x => IsTreatmentVariation(x) ? 0 : 1)
                .Select(x => x.Id)
                .ToArray();
        }

        if (!string.IsNullOrWhiteSpace(control))
        {
            run.ControlVariant = control;
        }

        if (treatments.Length > 0)
        {
            run.TreatmentVariant = string.Join("|", treatments);
        }
    }

    private static bool TryResolveNamedControlAndTreatments(
        IReadOnlyCollection<Variation> variations,
        out string control,
        out string[] treatments)
    {
        control = variations.FirstOrDefault(IsControlVariation)?.Id ?? string.Empty;
        treatments = variations
            .Where(IsTreatmentVariation)
            .Select(x => x.Id)
            .Where(x => !string.IsNullOrWhiteSpace(x))
            .ToArray();

        return !string.IsNullOrWhiteSpace(control) && treatments.Length > 0;
    }

    private static string? ResolveVariantId(
        string? token,
        IReadOnlyCollection<Variation> variations)
    {
        var normalized = Normalize(token);
        if (string.IsNullOrWhiteSpace(normalized))
        {
            return null;
        }

        return TryResolveExistingVariantId(normalized, variations) ?? normalized;
    }

    private static string? TryResolveExistingVariantId(
        string? token,
        IReadOnlyCollection<Variation> variations)
    {
        var normalized = Normalize(token);
        if (string.IsNullOrWhiteSpace(normalized))
        {
            return null;
        }

        var matched = variations.FirstOrDefault(x => VariantTokenEquals(x.Id, normalized));

        return matched?.Id;
    }

    private static string[] ResolveTreatmentVariantIds(
        string? value,
        IReadOnlyCollection<Variation> variations)
    {
        var normalized = Normalize(value);
        if (string.IsNullOrWhiteSpace(normalized))
        {
            return [];
        }

        var exact = TryResolveExistingVariantId(normalized, variations);
        if (!string.IsNullOrWhiteSpace(exact))
        {
            return [exact];
        }

        return SplitTreatments(normalized)
            .Select(x => ResolveVariantId(x, variations))
            .OfType<string>()
            .ToArray();
    }

    private static string? PickControlVariationId(
        FeatureFlag flag,
        IReadOnlyCollection<Variation> variations)
    {
        return variations.FirstOrDefault(IsControlVariation)?.Id
            ?? variations.FirstOrDefault(x => VariantTokenEquals(x.Id, flag.DisabledVariationId))?.Id
            ?? variations.First().Id;
    }

    private static bool IsControlVariation(Variation variation)
    {
        return VariantTokenEquals(variation.Name, "control");
    }

    private static bool IsTreatmentVariation(Variation variation)
    {
        return VariantTokenEquals(variation.Name, "treatment");
    }

    private static bool VariantTokenEquals(string? left, string? right)
    {
        return string.Equals(Normalize(left), Normalize(right), StringComparison.OrdinalIgnoreCase);
    }

    private static string BuildFeatureFlagVariantsJson(FeatureFlag flag)
    {
        var rows = (flag.Variations ?? [])
            .Where(x => !string.IsNullOrWhiteSpace(x.Id))
            .Select(x => new
            {
                key = x.Id,
                name = x.Name,
                value = x.Value,
                description = string.IsNullOrWhiteSpace(x.Value)
                    ? x.Name
                    : $"{x.Name} ({x.Value})"
            });

        return JsonSerializer.Serialize(rows);
    }

    private static ReleaseDecisionExperimentDetailVm ToDetailVm(ReleaseDecisionExperiment experiment)
    {
        var vm = new ReleaseDecisionExperimentDetailVm
        {
            Id = experiment.Id,
            Name = experiment.Name,
            Description = experiment.Description,
            Stage = experiment.Stage,
            FlagKey = experiment.FlagKey,
            FeatBitProjectKey = experiment.FeatBitProjectKey,
            FeatBitEnvId = experiment.FeatBitEnvId,
            Hypothesis = experiment.Hypothesis,
            AccessToken = experiment.AccessToken,
            Change = experiment.Change,
            Constraints = experiment.Constraints,
            EnvSecret = experiment.EnvSecret,
            FlagServerUrl = experiment.FlagServerUrl,
            Goal = experiment.Goal,
            Guardrails = experiment.Guardrails,
            Intent = experiment.Intent,
            LastAction = experiment.LastAction,
            LastLearning = experiment.LastLearning,
            OpenQuestions = experiment.OpenQuestions,
            PrimaryMetric = experiment.PrimaryMetric,
            SandboxId = experiment.SandboxId,
            SandboxStatus = experiment.SandboxStatus,
            Variants = experiment.Variants,
            ConflictAnalysis = experiment.ConflictAnalysis,
            EntryMode = experiment.EntryMode,
            CreatedAt = experiment.CreatedAt,
            UpdatedAt = experiment.UpdatedAt,
            ExperimentRuns = experiment.ExperimentRuns
                .OrderByDescending(x => x.CreatedAt)
                .Select(x => ToRunVm(x, experiment))
                .ToArray(),
            Activities = experiment.Activities
                .OrderByDescending(x => x.CreatedAt)
                .Take(20)
                .Select(ToActivityVm)
                .ToArray()
        };

        return vm;
    }

    private static ReleaseDecisionExperimentRunVm ToRunVm(
        ReleaseDecisionExperimentRun run,
        ReleaseDecisionExperiment? experiment = null)
    {
        if (experiment != null)
        {
            HydrateRunMetricConfig(run, experiment);
        }

        return new ReleaseDecisionExperimentRunVm
        {
            Id = run.Id,
            ExperimentId = run.ExperimentId,
            Slug = run.Slug,
            Status = run.Status,
            Hypothesis = run.Hypothesis,
            Method = run.Method,
            MethodReason = run.MethodReason,
            PrimaryMetricEvent = run.PrimaryMetricEvent,
            MetricDescription = run.MetricDescription,
            GuardrailEvents = run.GuardrailEvents,
            GuardrailDescriptions = run.GuardrailDescriptions,
            ControlVariant = run.ControlVariant,
            TreatmentVariant = run.TreatmentVariant,
            TrafficAllocation = run.TrafficAllocation,
            MinimumSample = run.MinimumSample,
            ObservationStart = run.ObservationStart,
            ObservationEnd = run.ObservationEnd,
            PriorProper = run.PriorProper,
            PriorMean = run.PriorMean,
            PriorStddev = run.PriorStddev,
            InputData = run.InputData,
            AnalysisResult = run.AnalysisResult,
            Decision = run.Decision,
            DecisionSummary = run.DecisionSummary,
            DecisionReason = run.DecisionReason,
            WhatChanged = run.WhatChanged,
            WhatHappened = run.WhatHappened,
            ConfirmedOrRefuted = run.ConfirmedOrRefuted,
            WhyItHappened = run.WhyItHappened,
            NextHypothesis = run.NextHypothesis,
            RunId = run.RunId,
            PrimaryMetricAgg = run.PrimaryMetricAgg,
            PrimaryMetricType = run.PrimaryMetricType,
            TrafficPercent = run.TrafficPercent,
            LayerId = run.LayerId,
            AudienceFilters = run.AudienceFilters,
            TrafficOffset = run.TrafficOffset,
            DataSourceMode = run.DataSourceMode,
            CustomerEndpointConfig = run.CustomerEndpointConfig,
            CreatedAt = run.CreatedAt,
            UpdatedAt = run.UpdatedAt
        };
    }

    private static ReleaseDecisionActivityVm ToActivityVm(ReleaseDecisionActivity activity)
    {
        return new ReleaseDecisionActivityVm
        {
            Id = activity.Id,
            Type = activity.Type,
            Title = activity.Title,
            Detail = activity.Detail,
            CreatedAt = activity.CreatedAt
        };
    }

    private static void ApplyUpdate(ReleaseDecisionExperiment experiment, ReleaseDecisionExperimentUpdate update)
    {
        experiment.Name = Normalize(update.Name, experiment.Name);
        experiment.Description = Normalize(update.Description, experiment.Description);
        experiment.Stage = Normalize(update.Stage, experiment.Stage);
        experiment.FlagKey = Normalize(update.FlagKey, experiment.FlagKey);
        experiment.Hypothesis = Normalize(update.Hypothesis, experiment.Hypothesis);
        experiment.AccessToken = Normalize(update.AccessToken, experiment.AccessToken);
        experiment.Change = Normalize(update.Change, experiment.Change);
        experiment.Constraints = Normalize(update.Constraints, experiment.Constraints);
        experiment.EnvSecret = Normalize(update.EnvSecret, experiment.EnvSecret);
        experiment.FlagServerUrl = Normalize(update.FlagServerUrl, experiment.FlagServerUrl);
        experiment.Goal = Normalize(update.Goal, experiment.Goal);
        experiment.Intent = Normalize(update.Intent, experiment.Intent);
        experiment.LastAction = Normalize(update.LastAction, experiment.LastAction);
        experiment.LastLearning = Normalize(update.LastLearning, experiment.LastLearning);
        experiment.OpenQuestions = Normalize(update.OpenQuestions, experiment.OpenQuestions);
        experiment.SandboxId = Normalize(update.SandboxId, experiment.SandboxId);
        experiment.Variants = Normalize(update.Variants, experiment.Variants);
        experiment.ConflictAnalysis = Normalize(update.ConflictAnalysis, experiment.ConflictAnalysis);
        experiment.EntryMode = Normalize(update.EntryMode, experiment.EntryMode);
    }

    private static void ApplyRunUpdate(ReleaseDecisionExperimentRun run, ReleaseDecisionExperimentRunUpdate update)
    {
        run.Slug = Normalize(update.Slug, run.Slug);
        run.Status = Normalize(update.Status, run.Status);
        run.Hypothesis = Normalize(update.Hypothesis, run.Hypothesis);
        run.Method = Normalize(update.Method, run.Method);
        run.MethodReason = Normalize(update.MethodReason, run.MethodReason);
        run.PrimaryMetricEvent = Normalize(update.PrimaryMetricEvent, run.PrimaryMetricEvent);
        run.MetricDescription = Normalize(update.MetricDescription, run.MetricDescription);
        run.GuardrailEvents = Normalize(update.GuardrailEvents, run.GuardrailEvents);
        run.GuardrailDescriptions = Normalize(update.GuardrailDescriptions, run.GuardrailDescriptions);
        run.ControlVariant = Normalize(update.ControlVariant, run.ControlVariant);
        run.TreatmentVariant = Normalize(update.TreatmentVariant, run.TreatmentVariant);
        run.TrafficAllocation = Normalize(update.TrafficAllocation, run.TrafficAllocation);
        run.InputData = Normalize(update.InputData, run.InputData);
        run.AnalysisResult = Normalize(update.AnalysisResult, run.AnalysisResult);
        run.Decision = Normalize(update.Decision, run.Decision);
        run.DecisionSummary = Normalize(update.DecisionSummary, run.DecisionSummary);
        run.DecisionReason = Normalize(update.DecisionReason, run.DecisionReason);
        run.WhatChanged = Normalize(update.WhatChanged, run.WhatChanged);
        run.WhatHappened = Normalize(update.WhatHappened, run.WhatHappened);
        run.ConfirmedOrRefuted = Normalize(update.ConfirmedOrRefuted, run.ConfirmedOrRefuted);
        run.WhyItHappened = Normalize(update.WhyItHappened, run.WhyItHappened);
        run.NextHypothesis = Normalize(update.NextHypothesis, run.NextHypothesis);
        run.RunId = Normalize(update.RunId, run.RunId);
        run.PrimaryMetricAgg = NormalizeMetricAgg(update.PrimaryMetricAgg ?? run.PrimaryMetricAgg);
        run.PrimaryMetricType = NormalizeMetricType(update.PrimaryMetricType ?? run.PrimaryMetricType);
        run.LayerId = Normalize(update.LayerId, run.LayerId);
        run.AudienceFilters = Normalize(update.AudienceFilters, run.AudienceFilters);
        run.DataSourceMode = Normalize(update.DataSourceMode, run.DataSourceMode);
        run.CustomerEndpointConfig = Normalize(update.CustomerEndpointConfig, run.CustomerEndpointConfig);

        if (update.MinimumSample.HasValue) run.MinimumSample = update.MinimumSample;
        if (update.ObservationStart.HasValue) run.ObservationStart = update.ObservationStart;
        if (update.ObservationEnd.HasValue) run.ObservationEnd = update.ObservationEnd;
        if (update.PriorProper.HasValue) run.PriorProper = update.PriorProper.Value;
        if (update.PriorMean.HasValue) run.PriorMean = update.PriorMean;
        if (update.PriorStddev.HasValue) run.PriorStddev = update.PriorStddev;
        if (update.TrafficPercent.HasValue) run.TrafficPercent = Math.Clamp(update.TrafficPercent.Value, 1, 100);
        if (update.TrafficOffset.HasValue) run.TrafficOffset = Math.Clamp(update.TrafficOffset.Value, 0, 99);
    }

    private static void HydrateRunMetricConfig(
        ReleaseDecisionExperimentRun run,
        ReleaseDecisionExperiment experiment)
    {
        if (string.IsNullOrWhiteSpace(run.PrimaryMetricEvent) &&
            TryReadPrimaryMetric(experiment.PrimaryMetric, out var primary))
        {
            run.PrimaryMetricEvent = primary.Event;
            run.MetricDescription = Normalize(run.MetricDescription, primary.Description ?? primary.Name);
            run.PrimaryMetricType = NormalizeMetricType(primary.MetricType ?? run.PrimaryMetricType);
            run.PrimaryMetricAgg = NormalizeMetricAgg(primary.MetricAgg ?? run.PrimaryMetricAgg);
        }

        if (string.IsNullOrWhiteSpace(run.GuardrailEvents))
        {
            run.GuardrailEvents = BuildGuardrailEventsJson(experiment.Guardrails);
        }
    }

    private static bool TryReadPrimaryMetric(
        string? raw,
        out (string Event, string? Name, string? Description, string? MetricType, string? MetricAgg, string? ExpectedDirection) primary)
    {
        primary = default;
        if (string.IsNullOrWhiteSpace(raw))
        {
            return false;
        }

        try
        {
            using var document = JsonDocument.Parse(raw);
            var root = document.RootElement;
            if (root.ValueKind != JsonValueKind.Object)
            {
                return false;
            }

            var eventName = GetJsonString(root, "event");
            if (string.IsNullOrWhiteSpace(eventName))
            {
                return false;
            }

            primary = (
                eventName,
                GetJsonString(root, "name"),
                GetJsonString(root, "description"),
                GetJsonString(root, "metricType"),
                GetJsonString(root, "metricAgg"),
                GetJsonString(root, "expectedDirection"));
            return true;
        }
        catch (JsonException)
        {
            return false;
        }
    }

    private static string? Normalize(string? value, string? fallback = null)
    {
        return string.IsNullOrWhiteSpace(value) ? fallback : value.Trim();
    }

    private async Task<ReleaseDecisionExperiment> GetTrackedExperimentAsync(Guid envId, Guid id)
    {
        var experiment = await dbContext.Set<ReleaseDecisionExperiment>()
            .AsTracking()
            .FirstOrDefaultAsync(x => x.Id == id && x.FeatBitEnvId == envId);

        if (experiment == null)
        {
            throw new EntityNotFoundException(nameof(ReleaseDecisionExperiment), $"{envId}-{id}");
        }

        return experiment;
    }

    private async Task EnsureExperimentExistsAsync(Guid envId, Guid id)
    {
        var exists = await dbContext.Set<ReleaseDecisionExperiment>()
            .AnyAsync(x => x.Id == id && x.FeatBitEnvId == envId);

        if (!exists)
        {
            throw new EntityNotFoundException(nameof(ReleaseDecisionExperiment), $"{envId}-{id}");
        }
    }

    private async Task<ReleaseDecisionExperimentRun> GetTrackedRunAsync(Guid experimentId, Guid runId)
    {
        var run = await dbContext.Set<ReleaseDecisionExperimentRun>()
            .AsTracking()
            .FirstOrDefaultAsync(x => x.Id == runId && x.ExperimentId == experimentId);

        if (run == null)
        {
            throw new EntityNotFoundException(nameof(ReleaseDecisionExperimentRun), $"{experimentId}-{runId}");
        }

        return run;
    }

    private async Task AddActivityAsync(
        Guid experimentId,
        string type,
        string title,
        string? detail = null,
        DateTime? createdAt = null)
    {
        await dbContext.Set<ReleaseDecisionActivity>().AddAsync(new ReleaseDecisionActivity
        {
            Id = Guid.NewGuid(),
            ExperimentId = experimentId,
            Type = type,
            Title = title,
            Detail = detail,
            CreatedAt = createdAt ?? DateTime.UtcNow
        });
    }

    private static string? BuildPrimaryMetricJson(ReleaseDecisionMetricsUpdate update)
    {
        if (string.IsNullOrWhiteSpace(update.MetricName) && string.IsNullOrWhiteSpace(update.MetricEvent))
        {
            return null;
        }

        var payload = new Dictionary<string, object>
        {
            ["metricType"] = NormalizeMetricType(update.MetricType),
            ["metricAgg"] = NormalizeMetricAgg(update.MetricAgg),
            ["expectedDirection"] = NormalizeExpectedDirection(update.ExpectedDirection)
        };

        if (!string.IsNullOrWhiteSpace(update.MetricName))
        {
            payload["name"] = update.MetricName.Trim();
        }

        if (!string.IsNullOrWhiteSpace(update.MetricEvent))
        {
            payload["event"] = update.MetricEvent.Trim();
        }

        if (!string.IsNullOrWhiteSpace(update.MetricDescription))
        {
            payload["description"] = update.MetricDescription.Trim();
        }

        return JsonSerializer.Serialize(payload);
    }

    private static string BuildInputDataJson(Dictionary<string, Dictionary<string, object>> metrics)
    {
        return JsonSerializer.Serialize(new Dictionary<string, object>
        {
            ["metrics"] = metrics
        });
    }

    private static Dictionary<string, object> BuildMetricData(
        string metricType,
        IEnumerable<ExperimentVariantStatsVm> variants)
    {
        var metricData = new Dictionary<string, object>();

        foreach (var row in variants)
        {
            if (string.IsNullOrWhiteSpace(row.Variant))
            {
                continue;
            }

            metricData[row.Variant] = metricType == "binary"
                ? new Dictionary<string, object>
                {
                    ["n"] = row.Users,
                    ["k"] = row.Conversions
                }
                : new Dictionary<string, object>
                {
                    ["n"] = row.Users,
                    ["sum"] = row.SumValue,
                    ["sum_squares"] = row.SumSquares
                };
        }

        return metricData;
    }

    private static (string Control, string[] Treatments) ResolveAnalysisVariantKeys(
        string? variantsJson,
        Dictionary<string, object> metricData,
        string control,
        string[] treatments)
    {
        var candidatesByToken = BuildVariantAnalysisKeyCandidates(variantsJson);
        var resolvedControl = ResolveAnalysisVariantKey(control, metricData, candidatesByToken);
        var resolvedTreatments = treatments
            .Select(x => ResolveAnalysisVariantKey(x, metricData, candidatesByToken))
            .Where(x => !string.IsNullOrWhiteSpace(x))
            .Where(x => !VariantTokenEquals(x, resolvedControl))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToArray();

        return (resolvedControl, resolvedTreatments);
    }

    private static string ResolveAnalysisVariantKey(
        string token,
        Dictionary<string, object> metricData,
        IReadOnlyDictionary<string, string[]> candidatesByToken)
    {
        var existing = FindExistingMetricKey(metricData, token);
        if (!string.IsNullOrWhiteSpace(existing))
        {
            return existing;
        }

        if (candidatesByToken.TryGetValue(token, out var candidates))
        {
            foreach (var candidate in candidates)
            {
                existing = FindExistingMetricKey(metricData, candidate);
                if (!string.IsNullOrWhiteSpace(existing))
                {
                    return existing;
                }
            }

            return candidates.FirstOrDefault() ?? token;
        }

        return token;
    }

    private static string? FindExistingMetricKey(Dictionary<string, object> metricData, string? token)
    {
        var normalized = Normalize(token);
        if (string.IsNullOrWhiteSpace(normalized))
        {
            return null;
        }

        return metricData.Keys.FirstOrDefault(key => VariantTokenEquals(key, normalized));
    }

    private static Dictionary<string, string[]> BuildVariantAnalysisKeyCandidates(string? variantsJson)
    {
        var map = new Dictionary<string, string[]>(StringComparer.OrdinalIgnoreCase);
        if (string.IsNullOrWhiteSpace(variantsJson))
        {
            return map;
        }

        try
        {
            using var document = JsonDocument.Parse(variantsJson);
            if (document.RootElement.ValueKind != JsonValueKind.Array)
            {
                return map;
            }

            foreach (var item in document.RootElement.EnumerateArray())
            {
                var key = GetJsonString(item, "key");
                var name = GetJsonString(item, "name");
                var value = GetJsonString(item, "value");
                var candidates = new[] { key, name, value }
                    .OfType<string>()
                    .Where(x => !string.IsNullOrWhiteSpace(x))
                    .Distinct(StringComparer.OrdinalIgnoreCase)
                    .ToArray();

                foreach (var token in candidates)
                {
                    map[token] = candidates;
                }
            }
        }
        catch (JsonException)
        {
            // If stored variant metadata is invalid, fall back to the run tokens.
        }

        return map;
    }

    private static string BuildBayesianAnalysisJson(
        ReleaseDecisionExperimentRun run,
        string experimentName,
        string primaryMetricEvent,
        string primaryMetricAgg,
        Dictionary<string, Dictionary<string, object>> metrics,
        IReadOnlyCollection<GuardrailDefinition> guardrails,
        string control,
        string[] treatments)
    {
        var prior = new GaussianPrior(
            run.PriorMean ?? 0,
            Math.Pow(run.PriorStddev ?? 0.3, 2),
            run.PriorProper);
        var priorLabel = prior.Proper
            ? $"Gaussian(mu={run.PriorMean ?? 0}, sigma={run.PriorStddev ?? 0.3})"
            : "flat (improper)";

        var primaryData = metrics.GetValueOrDefault(primaryMetricEvent);
        var observed = BuildObservedCounts(primaryData, control, treatments);
        var srmPValue = SrmCheck(observed.Values.ToArray());
        var minN = observed.Count == 0 ? 0 : observed.Values.Min();
        var minimumSample = run.MinimumSample ?? 0;
        var guardrailEvents = guardrails.Select(x => x.Event).ToHashSet();
        var primaryKey = metrics.Keys.FirstOrDefault(key => !guardrailEvents.Contains(key))
            ?? metrics.Keys.FirstOrDefault()
            ?? primaryMetricEvent;

        var warnings = new List<string>();
        var primaryMetric = metrics.TryGetValue(primaryKey, out var resolvedPrimaryData)
            ? ComputeMetricSection(primaryKey, resolvedPrimaryData, control, treatments, false, prior, primaryMetricAgg)
            : null;

        if (primaryMetric == null && resolvedPrimaryData != null)
        {
            var availableKeys = resolvedPrimaryData
                .Where(x => x.Value is Dictionary<string, object>)
                .Select(x => x.Key)
                .ToArray();
            var expectedKeys = new[] { control }.Concat(treatments)
                .ToHashSet(StringComparer.OrdinalIgnoreCase);
            var unexpected = availableKeys
                .Where(x => !expectedKeys.Contains(x))
                .ToArray();

            if (unexpected.Length > 0)
            {
                warnings.Add(
                    $"Unexpected variant data: expected [{string.Join(", ", expectedKeys)}] but metric data also has [{string.Join(", ", unexpected)}]. Update the run's control/treatment variant settings if these values should be included.");
            }
        }

        var guardrailSections = new List<Dictionary<string, object?>>();
        foreach (var guardrail in guardrails)
        {
            if (!metrics.TryGetValue(guardrail.Event, out var guardrailData))
            {
                continue;
            }

            if (guardrail.Inverse && !guardrailData.ContainsKey("inverse"))
            {
                guardrailData["inverse"] = true;
            }

            var section = ComputeMetricSection(
                guardrail.Event,
                guardrailData,
                control,
                treatments,
                true,
                null,
                guardrail.MetricAgg);
            if (section != null)
            {
                guardrailSections.Add(section);
            }
        }

        var payload = new Dictionary<string, object?>
        {
            ["type"] = "bayesian",
            ["experiment"] = experimentName,
            ["computed_at"] = DateTime.UtcNow,
            ["window"] = new Dictionary<string, object?>
            {
                ["start"] = run.ObservationStart,
                ["end"] = run.ObservationEnd
            },
            ["control"] = control,
            ["treatments"] = treatments,
            ["prior"] = priorLabel,
            ["srm"] = new Dictionary<string, object>
            {
                ["chi2_p_value"] = Round(srmPValue, 4),
                ["ok"] = srmPValue >= 0.01,
                ["observed"] = observed
            },
            ["primary_metric"] = primaryMetric,
            ["guardrails"] = guardrailSections,
            ["sample_check"] = new Dictionary<string, object>
            {
                ["minimum_per_variant"] = minimumSample,
                ["ok"] = minimumSample == 0 || minN >= minimumSample,
                ["variants"] = observed
            }
        };

        if (warnings.Count > 0)
        {
            payload["warnings"] = warnings;
        }

        return JsonSerializer.Serialize(payload);
    }

    private static string BuildBanditAnalysisJson(
        ReleaseDecisionExperimentRun run,
        string metricEvent,
        Dictionary<string, Dictionary<string, object>> metrics,
        string control,
        string[] treatments)
    {
        var prior = new GaussianPrior(
            run.PriorMean ?? 0,
            Math.Pow(run.PriorStddev ?? 0.3, 2),
            run.PriorProper);
        var arms = new[] { control }.Concat(treatments).ToArray();
        var metricData = metrics.GetValueOrDefault(metricEvent) ?? [];
        var stats = arms.Select(arm =>
        {
            var raw = GetVariantData(metricData, arm);
            var (mean, variance, n) = MetricMoments(raw);
            var conversions = raw != null && TryGetDouble(raw, "k", out var k) ? (long)Math.Floor(k) : 0L;
            var rate = raw != null && raw.ContainsKey("k") ? n > 0 ? conversions / (double)n : 0 : mean;
            return new BanditArmStat(arm, mean, variance, n, conversions, rate);
        }).ToArray();

        var observed = stats.ToDictionary(x => x.Arm, x => x.N);
        var srmPValue = SrmCheck(stats.Select(x => x.N).ToArray());
        var inverse = TryGetBool(metricData, "inverse");
        var bandit = ComputeBanditWeights(arms, stats, prior, inverse);
        var bestProbs = bandit.BestArmProbabilities ?? new Dictionary<string, double>();
        var weights = bandit.BanditWeights ?? new Dictionary<string, double>();
        var bestArm = arms.OrderByDescending(arm => bestProbs.GetValueOrDefault(arm)).FirstOrDefault() ?? control;
        var bestP = bestProbs.GetValueOrDefault(bestArm);
        const double threshold = 0.95;
        var stopMet = bandit.EnoughUnits && bestP >= threshold;

        var payload = new Dictionary<string, object?>
        {
            ["type"] = "bandit",
            ["experiment"] = run.Slug,
            ["computed_at"] = DateTime.UtcNow,
            ["window"] = new Dictionary<string, object?>
            {
                ["start"] = run.ObservationStart,
                ["end"] = run.ObservationEnd
            },
            ["metric"] = metricEvent,
            ["algorithm"] = "thompson_sampling_top_two",
            ["srm"] = new Dictionary<string, object>
            {
                ["chi2_p_value"] = Round(srmPValue, 4),
                ["ok"] = srmPValue >= 0.01,
                ["observed"] = observed
            },
            ["arms"] = stats.Select(x => new Dictionary<string, object>
            {
                ["arm"] = x.Arm,
                ["n"] = x.N,
                ["conversions"] = x.Conversions,
                ["rate"] = x.Rate
            }).ToArray(),
            ["thompson_sampling"] = new Dictionary<string, object?>
            {
                ["results"] = arms.Select(arm => new Dictionary<string, object>
                {
                    ["arm"] = arm,
                    ["p_best"] = bestProbs.GetValueOrDefault(arm),
                    ["recommended_weight"] = weights.GetValueOrDefault(arm)
                }).ToArray(),
                ["enough_units"] = bandit.EnoughUnits,
                ["update_message"] = bandit.UpdateMessage,
                ["seed"] = bandit.Seed
            },
            ["stopping"] = new Dictionary<string, object>
            {
                ["met"] = stopMet,
                ["best_arm"] = bestArm,
                ["p_best"] = bestP,
                ["threshold"] = threshold,
                ["message"] = stopMet
                    ? $"{bestArm} reached P(best)={bestP:0.0000} >= {threshold:0.00}"
                    : bandit.EnoughUnits
                        ? $"best arm {bestArm} currently at P(best)={bestP:0.0000}, threshold={threshold:0.00}"
                        : bandit.UpdateMessage
            }
        };

        return JsonSerializer.Serialize(payload);
    }

    private static Dictionary<string, object?>? ComputeMetricSection(
        string label,
        Dictionary<string, object> metricData,
        string control,
        string[] treatments,
        bool isGuardrail,
        GaussianPrior? prior,
        string? metricAgg)
    {
        var inverse = TryGetBool(metricData, "inverse");
        var isProp = IsBinaryMetricData(metricData);
        var ctrlRaw = GetVariantData(metricData, control) ?? EmptyVariantData(isProp);
        var (meanA, varA, nA) = MetricMoments(ctrlRaw);
        var rows = new List<Dictionary<string, object?>>();
        var ctrlRow = new Dictionary<string, object?>
        {
            ["variant"] = control,
            ["n"] = nA,
            ["is_control"] = true
        };

        if (isProp)
        {
            ctrlRow["conversions"] = (long)Math.Floor(GetDouble(ctrlRaw, "k"));
            ctrlRow["rate"] = Round(meanA, 6);
        }
        else
        {
            ctrlRow["mean"] = Round(meanA, 4);
        }
        rows.Add(ctrlRow);

        var verdicts = new List<string>();
        foreach (var treatment in treatments)
        {
            var trtRaw = GetVariantData(metricData, treatment) ?? EmptyVariantData(isProp);
            var (meanB, varB, nB) = MetricMoments(trtRaw);
            var bay = BayesianResult(meanA, varA, nA, meanB, varB, nB, inverse, prior);
            var trtRow = new Dictionary<string, object?>
            {
                ["variant"] = treatment,
                ["n"] = nB,
                ["is_control"] = false
            };

            if (isProp)
            {
                trtRow["conversions"] = (long)Math.Floor(GetDouble(trtRaw, "k"));
                trtRow["rate"] = Round(meanB, 6);
            }
            else
            {
                trtRow["mean"] = Round(meanB, 4);
            }

            if (bay.Error == null)
            {
                trtRow["rel_delta"] = Round(bay.RelativeChange, 6);
                trtRow["ci_lower"] = Round(bay.CiRelLower, 6);
                trtRow["ci_upper"] = Round(bay.CiRelUpper, 6);
                if (isGuardrail)
                {
                    trtRow["p_harm"] = Round(1 - bay.ChanceToWin, 4);
                    trtRow["risk_ctrl"] = Round(bay.RiskCtrl, 6);
                    trtRow["risk_trt"] = Round(bay.RiskTrt, 6);
                }
                else
                {
                    trtRow["p_win"] = Round(bay.ChanceToWin, 4);
                    trtRow["risk_ctrl"] = Round(bay.RiskCtrl, 6);
                    trtRow["risk_trt"] = Round(bay.RiskTrt, 6);
                }

                var prefix = treatments.Length > 1 ? $"{treatment}: " : "";
                if (isGuardrail)
                {
                    var pHarm = 1 - bay.ChanceToWin;
                    verdicts.Add(pHarm <= GuardrailHealthyHarmProbability
                        ? $"{prefix}guardrail clear"
                        : pHarm >= GuardrailAlarmHarmProbability
                            ? $"{prefix}guardrail ALARM - likely regression"
                            : $"{prefix}guardrail inconclusive - monitor");
                }
                else
                {
                    verdicts.Add(bay.ChanceToWin >= 0.95
                        ? $"{prefix}strong signal -> adopt treatment"
                        : bay.ChanceToWin >= 0.8
                            ? $"{prefix}leaning treatment"
                            : bay.ChanceToWin <= 0.05
                                ? $"{prefix}treatment appears harmful"
                                : bay.ChanceToWin <= 0.2
                                    ? $"{prefix}leaning control"
                                    : $"{prefix}inconclusive");
                }
            }

            rows.Add(trtRow);
        }

        var section = new Dictionary<string, object?>
        {
            ["event"] = label,
            ["metric_type"] = isProp ? "proportion" : "continuous",
            ["rows"] = rows,
            ["verdict"] = verdicts.Count > 0 ? string.Join("; ", verdicts) : "no data"
        };

        if (inverse)
        {
            section["inverse"] = true;
        }

        if (metricAgg is "once" or "count" or "sum" or "average")
        {
            section["metric_agg"] = metricAgg;
        }

        return section;
    }

    private static bool IsBinaryMetricData(Dictionary<string, object> metricData)
    {
        return metricData.Values
            .Select(value => value switch
            {
                Dictionary<string, object> data => data,
                JsonElement element when element.ValueKind == JsonValueKind.Object => GetVariantData(
                    new Dictionary<string, object> { ["_"] = element },
                    "_"),
                _ => null
            })
            .OfType<Dictionary<string, object>>()
            .Any(data => data.ContainsKey("k"));
    }

    private static Dictionary<string, object> EmptyVariantData(bool isBinary)
    {
        return isBinary
            ? new Dictionary<string, object>
            {
                ["n"] = 0L,
                ["k"] = 0L
            }
            : new Dictionary<string, object>
            {
                ["n"] = 0L,
                ["sum"] = 0D,
                ["sum_squares"] = 0D
            };
    }

    private static string[] SplitTreatments(string? value)
    {
        var normalized = Normalize(value);
        if (string.IsNullOrWhiteSpace(normalized))
        {
            return ["treatment"];
        }

        return normalized
            .Split(['|', ','], StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .DefaultIfEmpty("treatment")
            .ToArray();
    }

    private static List<GuardrailDefinition> ParseGuardrailDefinitions(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return [];
        }

        try
        {
            using var doc = JsonDocument.Parse(value);
            if (doc.RootElement.ValueKind != JsonValueKind.Array)
            {
                return [];
            }

            var guardrails = new List<GuardrailDefinition>();
            foreach (var item in doc.RootElement.EnumerateArray())
            {
                if (item.ValueKind == JsonValueKind.String)
                {
                    var eventName = item.GetString();
                    if (!string.IsNullOrWhiteSpace(eventName))
                    {
                        guardrails.Add(new GuardrailDefinition(eventName.Trim(), "binary", "once", false));
                    }
                    continue;
                }

                if (item.ValueKind != JsonValueKind.Object)
                {
                    continue;
                }

                var name = GetJsonString(item, "event") ?? GetJsonString(item, "name");
                if (string.IsNullOrWhiteSpace(name))
                {
                    continue;
                }

                guardrails.Add(new GuardrailDefinition(
                    name.Trim(),
                    NormalizeMetricType(GetJsonString(item, "metricType")),
                    NormalizeMetricAgg(GetJsonString(item, "metricAgg")),
                    GetJsonBool(item, "inverse") ?? GetJsonString(item, "direction") == "increase_bad"));
            }

            return guardrails;
        }
        catch
        {
            return [];
        }
    }

    private static Dictionary<string, long> BuildObservedCounts(
        Dictionary<string, object>? metricData,
        string control,
        string[] treatments)
    {
        var observed = new Dictionary<string, long>();
        if (metricData == null)
        {
            return observed;
        }

        foreach (var variant in new[] { control }.Concat(treatments))
        {
            var data = GetVariantData(metricData, variant);
            observed[variant] = data == null ? 0 : (long)Math.Floor(GetDouble(data, "n"));
        }

        return observed;
    }

    private static Dictionary<string, object>? GetVariantData(Dictionary<string, object> metricData, string variant)
    {
        if (!metricData.TryGetValue(variant, out var value))
        {
            return null;
        }

        if (value is Dictionary<string, object> data)
        {
            return data;
        }

        if (value is JsonElement element && element.ValueKind == JsonValueKind.Object)
        {
            return element.EnumerateObject().ToDictionary(
                prop => prop.Name,
                prop => prop.Value.ValueKind switch
                {
                    JsonValueKind.Number when prop.Value.TryGetInt64(out var l) => (object)l,
                    JsonValueKind.Number when prop.Value.TryGetDouble(out var d) => d,
                    JsonValueKind.True => true,
                    JsonValueKind.False => false,
                    JsonValueKind.String => prop.Value.GetString() ?? string.Empty,
                    _ => prop.Value.ToString()
                });
        }

        return null;
    }

    private static (double Mean, double Variance, long N) MetricMoments(Dictionary<string, object>? data)
    {
        if (data == null)
        {
            return (0, 0, 0);
        }

        var n = (long)Math.Floor(GetDouble(data, "n"));
        if (n == 0)
        {
            return (0, 0, 0);
        }

        if (data.ContainsKey("k"))
        {
            var mean = GetDouble(data, "k") / n;
            return (mean, mean * (1 - mean), n);
        }

        if (data.ContainsKey("sum"))
        {
            var sum = GetDouble(data, "sum");
            var sumSquares = GetDouble(data, "sum_squares");
            var mean = sum / n;
            var variance = n > 1 ? (sumSquares - sum * sum / n) / (n - 1) : 0;
            return (mean, variance, n);
        }

        if (data.ContainsKey("mean"))
        {
            return (GetDouble(data, "mean"), GetDouble(data, "variance"), n);
        }

        return (0, 0, 0);
    }

    private static BayesianComparison BayesianResult(
        double meanA,
        double varA,
        long nA,
        double meanB,
        double varB,
        long nB,
        bool inverse,
        GaussianPrior? prior)
    {
        if (nA == 0 || nB == 0)
        {
            return BayesianComparison.Failed("zero sample size");
        }

        if (meanA == 0)
        {
            return BayesianComparison.Failed("control mean is zero - cannot compute relative effect");
        }

        var muRel = (meanB - meanA) / meanA;
        var muAbs = meanB - meanA;
        var seRel = DeltaMethodSe(meanA, varA, nA, meanB, varB, nB, true);
        if (seRel == 0)
        {
            return DeterministicComparison(muRel, muAbs, inverse);
        }

        var priorApplied = false;
        if (prior is { Proper: true })
        {
            var dataPrecision = 1 / Math.Pow(seRel, 2);
            var priorPrecision = 1 / prior.Variance;
            var postPrecision = dataPrecision + priorPrecision;
            muRel = (muRel * dataPrecision + prior.Mean * priorPrecision) / postPrecision;
            seRel = Math.Sqrt(1 / postPrecision);
            priorApplied = true;
        }

        var zHalf = NormalPpf(0.975);
        var chanceToWin = NormalSf(0, muRel, seRel);
        if (inverse)
        {
            chanceToWin = 1 - chanceToWin;
        }

        var (riskCtrl, riskTrt) = Risk(muRel, seRel);
        if (inverse)
        {
            (riskCtrl, riskTrt) = (riskTrt, riskCtrl);
        }

        return new BayesianComparison(
            null,
            chanceToWin,
            muRel,
            muAbs,
            muRel - zHalf * seRel,
            muRel + zHalf * seRel,
            riskCtrl,
            riskTrt,
            priorApplied);
    }

    private static BayesianComparison DeterministicComparison(double muRel, double muAbs, bool inverse)
    {
        var chanceToWin = muRel switch
        {
            > 0 => 1,
            < 0 => 0,
            _ => 0.5
        };

        if (inverse)
        {
            chanceToWin = 1 - chanceToWin;
        }

        var riskCtrl = muRel > 0 ? muRel : 0;
        var riskTrt = muRel < 0 ? -muRel : 0;
        if (inverse)
        {
            (riskCtrl, riskTrt) = (riskTrt, riskCtrl);
        }

        return new BayesianComparison(
            null,
            chanceToWin,
            muRel,
            muAbs,
            muRel,
            muRel,
            riskCtrl,
            riskTrt,
            false);
    }

    private static double DeltaMethodSe(
        double meanA,
        double varA,
        long nA,
        double meanB,
        double varB,
        long nB,
        bool relative)
    {
        if (relative)
        {
            if (meanA == 0)
            {
                return 0;
            }

            return Math.Sqrt(
                varB / (nB * Math.Pow(meanA, 2)) +
                varA * Math.Pow(meanB, 2) / (nA * Math.Pow(meanA, 4)));
        }

        return Math.Sqrt(varB / nB + varA / nA);
    }

    private static (double RiskCtrl, double RiskTrt) Risk(double mu, double sigma)
    {
        var pCtrlBetter = NormalCdf(0, mu, sigma);
        var meanNegative = TruncatedNormalMean(mu, sigma, double.NegativeInfinity, 0);
        var meanPositive = TruncatedNormalMean(mu, sigma, 0, double.PositiveInfinity);

        return ((1 - pCtrlBetter) * meanPositive, -pCtrlBetter * meanNegative);
    }

    private static BanditWeightResult ComputeBanditWeights(
        string[] arms,
        BanditArmStat[] stats,
        GaussianPrior prior,
        bool inverse)
    {
        const int minUnitsPerArm = 100;
        const double minArmWeight = 0.01;
        const int sampleCount = 10_000;

        var counts = stats.Select(x => x.N).ToArray();
        if (counts.Any(x => x < minUnitsPerArm))
        {
            var minN = counts.Length == 0 ? 0 : counts.Min();
            return new BanditWeightResult(
                false,
                $"burn-in: need >= {minUnitsPerArm} users per arm before dynamic weighting (current minimum: {minN})",
                null,
                null,
                null);
        }

        var posteriors = stats.Select(x => ArmPosterior(x.Mean, x.Variance, x.N, prior)).ToArray();
        var postMeans = posteriors.Select(x => x.Mean).ToArray();
        var postStddevs = posteriors.Select(x => Math.Sqrt(Math.Max(x.Variance, 1e-12))).ToArray();
        var seed = Random.Shared.Next(0, 1_000_000);
        var rng = new Mulberry32(seed);
        var bestCounts = new int[arms.Length];
        var topTwoCounts = new int[arms.Length];

        for (var i = 0; i < sampleCount; i++)
        {
            var order = arms
                .Select((_, idx) => new
                {
                    Index = idx,
                    Value = postMeans[idx] + postStddevs[idx] * Normal01(rng)
                })
                .OrderBy(x => inverse ? x.Value : -x.Value)
                .ToArray();

            bestCounts[order[0].Index]++;
            if (arms.Length > 1)
            {
                topTwoCounts[order[0].Index]++;
                topTwoCounts[order[1].Index]++;
            }
        }

        var bestProbabilities = new Dictionary<string, double>();
        for (var i = 0; i < arms.Length; i++)
        {
            bestProbabilities[arms[i]] = bestCounts[i] / (double)sampleCount;
        }

        var weights = new double[arms.Length];
        if (arms.Length > 1)
        {
            var denominator = topTwoCounts.Sum();
            for (var i = 0; i < arms.Length; i++)
            {
                weights[i] = denominator > 0 ? topTwoCounts[i] / (double)denominator : 1 / (double)arms.Length;
            }
        }
        else
        {
            weights[0] = 1;
        }

        for (var i = 0; i < weights.Length; i++)
        {
            weights[i] = Math.Max(weights[i], minArmWeight);
        }

        var sumWeights = weights.Sum();
        var banditWeights = new Dictionary<string, double>();
        for (var i = 0; i < arms.Length; i++)
        {
            banditWeights[arms[i]] = weights[i] / sumWeights;
        }

        return new BanditWeightResult(true, "successfully updated", bestProbabilities, banditWeights, seed);
    }

    private static (double Mean, double Variance) ArmPosterior(
        double mean,
        double variance,
        long n,
        GaussianPrior prior)
    {
        if (n == 0 || variance == 0)
        {
            return (prior.Mean, prior.Variance);
        }

        var dataVariance = variance / n;
        if (!prior.Proper)
        {
            return (mean, dataVariance);
        }

        var dataPrecision = 1 / dataVariance;
        var priorPrecision = 1 / prior.Variance;
        var postPrecision = dataPrecision + priorPrecision;
        return ((mean * dataPrecision + prior.Mean * priorPrecision) / postPrecision, 1 / postPrecision);
    }

    private static double Normal01(Mulberry32 rng)
    {
        var u1 = Math.Max(rng.NextDouble(), 1e-12);
        var u2 = rng.NextDouble();
        return Math.Sqrt(-2 * Math.Log(u1)) * Math.Cos(2 * Math.PI * u2);
    }

    private static double SrmCheck(long[] observed)
    {
        var total = observed.Sum();
        if (total == 0)
        {
            return 1.0;
        }

        var expected = total / (double)observed.Length;
        var chiSquared = observed.Sum(value => Math.Pow(value - expected, 2) / expected);
        return Chi2Sf(chiSquared, observed.Length - 1);
    }

    private static double Chi2Sf(double x, int degreesOfFreedom)
    {
        if (x <= 0)
        {
            return 1.0;
        }

        return 1.0 - RegularizedGammaP(degreesOfFreedom / 2.0, x / 2.0);
    }

    private static double RegularizedGammaP(double a, double x)
    {
        if (x <= 0)
        {
            return 0;
        }

        return x < a + 1 ? GammaPSeries(a, x) : 1.0 - GammaQContinuedFraction(a, x);
    }

    private static double GammaPSeries(double a, double x)
    {
        var logGammaA = LogGamma(a);
        var sum = 1.0 / a;
        var term = 1.0 / a;
        for (var n = 1; n < 200; n++)
        {
            term *= x / (a + n);
            sum += term;
            if (Math.Abs(term) < Math.Abs(sum) * 1e-14)
            {
                break;
            }
        }

        return sum * Math.Exp(-x + a * Math.Log(x) - logGammaA);
    }

    private static double GammaQContinuedFraction(double a, double x)
    {
        var logGammaA = LogGamma(a);
        const double tiny = 1e-30;
        var b = x + 1 - a;
        var c = 1.0 / tiny;
        var d = 1.0 / b;
        var h = d;

        for (var n = 1; n < 200; n++)
        {
            var an = -n * (n - a);
            b += 2;
            d = an * d + b;
            if (Math.Abs(d) < tiny)
            {
                d = tiny;
            }

            c = b + an / c;
            if (Math.Abs(c) < tiny)
            {
                c = tiny;
            }

            d = 1.0 / d;
            var delta = d * c;
            h *= delta;
            if (Math.Abs(delta - 1.0) < 1e-14)
            {
                break;
            }
        }

        return h * Math.Exp(-x + a * Math.Log(x) - logGammaA);
    }

    private static double LogGamma(double x)
    {
        double[] coefficients =
        [
            0.99999999999980993, 676.5203681218851, -1259.1392167224028,
            771.32342877765313, -176.61502916214059, 12.507343278686905,
            -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7
        ];

        if (x < 0.5)
        {
            return Math.Log(Math.PI / Math.Sin(Math.PI * x)) - LogGamma(1 - x);
        }

        x -= 1;
        var sum = coefficients[0];
        for (var i = 1; i <= 8; i++)
        {
            sum += coefficients[i] / (x + i);
        }

        var t = x + 7.5;
        return 0.5 * Math.Log(2 * Math.PI) + (x + 0.5) * Math.Log(t) - t + Math.Log(sum);
    }

    private static double NormalCdf(double x, double mu = 0, double sigma = 1)
    {
        return 0.5 * (1 + Erf((x - mu) / (sigma * Math.Sqrt(2))));
    }

    private static double NormalSf(double x, double mu = 0, double sigma = 1)
    {
        return 1 - NormalCdf(x, mu, sigma);
    }

    private static double NormalPdf(double x, double mu = 0, double sigma = 1)
    {
        var z = (x - mu) / sigma;
        return Math.Exp(-0.5 * z * z) / (sigma * Math.Sqrt(2 * Math.PI));
    }

    private static double NormalPpf(double p)
    {
        if (p <= 0)
        {
            return double.NegativeInfinity;
        }

        if (p >= 1)
        {
            return double.PositiveInfinity;
        }

        if (p == 0.5)
        {
            return 0;
        }

        double[] a =
        [
            -3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2,
            1.383577518672690e2, -3.066479806614716e1, 2.506628277459239e0
        ];
        double[] b =
        [
            -5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2,
            6.680131188771972e1, -1.328068155288572e1
        ];
        double[] c =
        [
            -7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838e0,
            -2.549732539343734e0, 4.374664141464968e0, 2.938163982698783e0
        ];
        double[] d =
        [
            7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996e0,
            3.754408661907416e0
        ];

        const double pLow = 0.02425;
        var pHigh = 1 - pLow;
        double q;

        if (p < pLow)
        {
            q = Math.Sqrt(-2 * Math.Log(p));
            return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
                ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
        }

        if (p <= pHigh)
        {
            q = p - 0.5;
            var r = q * q;
            return ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q) /
                (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
        }

        q = Math.Sqrt(-2 * Math.Log(1 - p));
        return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
            ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
    }

    private static double TruncatedNormalMean(double mu, double sigma, double a, double b)
    {
        var phiAlpha = double.IsFinite(a) ? NormalPdf((a - mu) / sigma) : 0;
        var phiBeta = double.IsFinite(b) ? NormalPdf((b - mu) / sigma) : 0;
        var cdfAlpha = double.IsFinite(a) ? NormalCdf((a - mu) / sigma) : 0;
        var cdfBeta = double.IsFinite(b) ? NormalCdf((b - mu) / sigma) : 1;
        var denominator = cdfBeta - cdfAlpha;
        return denominator <= 0 ? mu : mu + sigma * (phiAlpha - phiBeta) / denominator;
    }

    private static double Erf(double x)
    {
        var sign = x >= 0 ? 1 : -1;
        var absolute = Math.Abs(x);
        const double a1 = 0.254829592;
        const double a2 = -0.284496736;
        const double a3 = 1.421413741;
        const double a4 = -1.453152027;
        const double a5 = 1.061405429;
        const double p = 0.3275911;
        var t = 1.0 / (1.0 + p * absolute);
        var y = 1.0 - (((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t) *
            Math.Exp(-absolute * absolute);
        return sign * y;
    }

    private static double GetDouble(Dictionary<string, object> data, string key)
    {
        return TryGetDouble(data, key, out var value) ? value : 0;
    }

    private static bool TryGetDouble(Dictionary<string, object> data, string key, out double value)
    {
        value = 0;
        if (!data.TryGetValue(key, out var raw))
        {
            return false;
        }

        switch (raw)
        {
            case double d:
                value = d;
                return true;
            case float f:
                value = f;
                return true;
            case decimal m:
                value = (double)m;
                return true;
            case int i:
                value = i;
                return true;
            case long l:
                value = l;
                return true;
            case JsonElement element when element.ValueKind == JsonValueKind.Number && element.TryGetDouble(out var d):
                value = d;
                return true;
            default:
                return false;
        }
    }

    private static bool TryGetBool(Dictionary<string, object> data, string key)
    {
        if (!data.TryGetValue(key, out var raw))
        {
            return false;
        }

        return raw switch
        {
            bool b => b,
            JsonElement element => element.ValueKind == JsonValueKind.True,
            _ => false
        };
    }

    private static double Round(double value, int decimals)
    {
        var factor = Math.Pow(10, decimals);
        return Math.Round(value * factor) / factor;
    }

    private sealed record GuardrailDefinition(string Event, string MetricType, string MetricAgg, bool Inverse);

    private sealed record GaussianPrior(double Mean, double Variance, bool Proper);

    private sealed record BayesianComparison(
        string? Error,
        double ChanceToWin,
        double RelativeChange,
        double AbsoluteChange,
        double CiRelLower,
        double CiRelUpper,
        double RiskCtrl,
        double RiskTrt,
        bool PriorApplied)
    {
        public static BayesianComparison Failed(string error)
        {
            return new BayesianComparison(error, 0, 0, 0, 0, 0, 0, 0, false);
        }
    }

    private sealed record BanditArmStat(
        string Arm,
        double Mean,
        double Variance,
        long N,
        long Conversions,
        double Rate);

    private sealed record BanditWeightResult(
        bool EnoughUnits,
        string UpdateMessage,
        Dictionary<string, double>? BestArmProbabilities,
        Dictionary<string, double>? BanditWeights,
        int? Seed);

    private sealed class Mulberry32
    {
        private uint _state;

        public Mulberry32(int seed)
        {
            _state = (uint)seed;
        }

        public double NextDouble()
        {
            unchecked
            {
                _state += 0x6D2B79F5u;
                var x = _state;
                x = (x ^ (x >> 15)) * (1u | x);
                x ^= x + (x ^ (x >> 7)) * (61u | x);
                return (x ^ (x >> 14)) / 4294967296.0;
            }
        }
    }

    private static string? BuildGuardrailEventsJson(string? guardrails)
    {
        if (string.IsNullOrWhiteSpace(guardrails))
        {
            return null;
        }

        try
        {
            using var doc = JsonDocument.Parse(guardrails);
            if (doc.RootElement.ValueKind != JsonValueKind.Array)
            {
                return null;
            }

            var events = new List<Dictionary<string, object>>();
            foreach (var item in doc.RootElement.EnumerateArray())
            {
                if (item.ValueKind != JsonValueKind.Object)
                {
                    continue;
                }

                var eventName = GetJsonString(item, "event");
                if (string.IsNullOrWhiteSpace(eventName))
                {
                    eventName = GetJsonString(item, "name");
                }

                if (string.IsNullOrWhiteSpace(eventName))
                {
                    continue;
                }

                events.Add(new Dictionary<string, object>
                {
                    ["event"] = eventName.Trim(),
                    ["metricType"] = NormalizeMetricType(GetJsonString(item, "metricType")),
                    ["metricAgg"] = NormalizeMetricAgg(GetJsonString(item, "metricAgg")),
                    ["inverse"] = GetJsonBool(item, "inverse") ?? GetJsonString(item, "direction") == "increase_bad"
                });
            }

            return events.Count == 0 ? null : JsonSerializer.Serialize(events);
        }
        catch
        {
            return null;
        }
    }

    private static string? GetJsonString(JsonElement element, string property)
    {
        return element.TryGetProperty(property, out var value) && value.ValueKind == JsonValueKind.String
            ? value.GetString()
            : null;
    }

    private static bool? GetJsonBool(JsonElement element, string property)
    {
        return element.TryGetProperty(property, out var value) && value.ValueKind == JsonValueKind.True
            ? true
            : element.TryGetProperty(property, out value) && value.ValueKind == JsonValueKind.False
                ? false
                : null;
    }

    private static string NormalizeMetricType(string? value)
    {
        return value is "continuous" or "numeric" ? "continuous" : "binary";
    }

    private static string NormalizeMetricAgg(string? value)
    {
        return value is "count" or "sum" or "average" ? value : "once";
    }

    private static string NormalizeExpectedDirection(string? value)
    {
        return IsDecreaseGood(value) ? "decrease_good" : "increase_good";
    }

    private static bool IsDecreaseGood(string? value)
    {
        return value == "decrease_good";
    }
}
