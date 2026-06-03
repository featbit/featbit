using Application.Bases.Models;
using Application.Bases.Exceptions;
using Application.ExperimentStats;
using Application.ReleaseDecisions;
using Domain.ReleaseDecisions;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;

namespace Infrastructure.Services.EntityFrameworkCore;

public class ReleaseDecisionExperimentService(
    AppDbContext dbContext,
    IExperimentStatsService statsService)
    : IReleaseDecisionExperimentService
{
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
        var experiment = await QueryDetail()
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == id && x.FeatBitEnvId == envId);

        if (experiment == null)
        {
            throw new EntityNotFoundException(nameof(ReleaseDecisionExperiment), $"{envId}-{id}");
        }

        return ToDetailVm(experiment);
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
        await EnsureExperimentExistsAsync(envId, id);

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
        await EnsureExperimentExistsAsync(envId, id);

        var run = await GetTrackedRunAsync(id, runId);
        ApplyRunUpdate(run, update);
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
        var inputData = BuildInputDataJson(primaryMetricEvent, metricType, variants);
        var analysisResult = BuildStatsAnalysisJson(
            run,
            experiment.FlagKey,
            primaryMetricEvent,
            metricType,
            metricAgg,
            stats,
            variants);

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

    public async Task<ReleaseDecisionExperimentDetailVm> AddMessageAsync(
        Guid envId,
        Guid id,
        ReleaseDecisionExperimentMessageCreation creation)
    {
        creation ??= new ReleaseDecisionExperimentMessageCreation();
        await EnsureExperimentExistsAsync(envId, id);

        var content = Normalize(creation.Content);
        if (string.IsNullOrWhiteSpace(content))
        {
            return await GetAsync(envId, id);
        }

        var role = creation.Role == "assistant" ? "assistant" : "user";
        var now = DateTime.UtcNow;

        await dbContext.Set<ReleaseDecisionMessage>().AddAsync(new ReleaseDecisionMessage
        {
            Id = Guid.NewGuid(),
            ExperimentId = id,
            Role = role,
            Content = content,
            Metadata = Normalize(creation.Metadata),
            CreatedAt = now
        });

        await AddActivityAsync(
            id,
            "note",
            role == "assistant" ? "Local Claude Code response recorded" : "Local Claude Code prompt recorded",
            content.Length > 120 ? content[..120] : content,
            now);

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

        var items = await query
            .OrderByDescending(x => x.UpdatedAt)
            .ThenByDescending(x => x.CreatedAt)
            .Skip(pageIndex * pageSize)
            .Take(pageSize)
            .Select(x => new ReleaseDecisionExperimentVm
            {
                Id = x.Id,
                Name = x.Name,
                Description = x.Description,
                Stage = x.Stage,
                FlagKey = x.FlagKey,
                FeatBitProjectKey = x.FeatBitProjectKey,
                FeatBitEnvId = x.FeatBitEnvId,
                CreatedAt = x.CreatedAt,
                UpdatedAt = x.UpdatedAt
            })
            .ToListAsync();

        return new PagedResult<ReleaseDecisionExperimentVm>(totalCount, items);
    }

    private static ReleaseDecisionExperimentVm ToVm(ReleaseDecisionExperiment experiment)
    {
        return new ReleaseDecisionExperimentVm
        {
            Id = experiment.Id,
            Name = experiment.Name,
            Description = experiment.Description,
            Stage = experiment.Stage,
            FlagKey = experiment.FlagKey,
            FeatBitProjectKey = experiment.FeatBitProjectKey,
            FeatBitEnvId = experiment.FeatBitEnvId,
            CreatedAt = experiment.CreatedAt,
            UpdatedAt = experiment.UpdatedAt
        };
    }

    private IQueryable<ReleaseDecisionExperiment> QueryDetail()
    {
        return dbContext.Set<ReleaseDecisionExperiment>()
            .Include(x => x.ExperimentRuns)
            .Include(x => x.Activities)
            .Include(x => x.Messages);
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
                .Select(ToRunVm)
                .ToArray(),
            Activities = experiment.Activities
                .OrderByDescending(x => x.CreatedAt)
                .Take(20)
                .Select(ToActivityVm)
                .ToArray(),
            Messages = experiment.Messages
                .OrderBy(x => x.CreatedAt)
                .Select(ToMessageVm)
                .ToArray()
        };

        return vm;
    }

    private static ReleaseDecisionExperimentRunVm ToRunVm(ReleaseDecisionExperimentRun run)
    {
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

    private static ReleaseDecisionMessageVm ToMessageVm(ReleaseDecisionMessage message)
    {
        return new ReleaseDecisionMessageVm
        {
            Id = message.Id,
            Role = message.Role,
            Content = message.Content,
            Metadata = message.Metadata,
            CreatedAt = message.CreatedAt
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
        experiment.Guardrails = Normalize(update.Guardrails, experiment.Guardrails);
        experiment.Intent = Normalize(update.Intent, experiment.Intent);
        experiment.LastAction = Normalize(update.LastAction, experiment.LastAction);
        experiment.LastLearning = Normalize(update.LastLearning, experiment.LastLearning);
        experiment.OpenQuestions = Normalize(update.OpenQuestions, experiment.OpenQuestions);
        experiment.PrimaryMetric = Normalize(update.PrimaryMetric, experiment.PrimaryMetric);
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
            ["metricAgg"] = NormalizeMetricAgg(update.MetricAgg)
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

    private static string BuildInputDataJson(
        string metricEvent,
        string metricType,
        IEnumerable<ExperimentVariantStatsVm> variants)
    {
        var variantStats = new Dictionary<string, object>();

        foreach (var row in variants)
        {
            if (string.IsNullOrWhiteSpace(row.Variant))
            {
                continue;
            }

            variantStats[row.Variant] = metricType == "binary"
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

        return JsonSerializer.Serialize(new Dictionary<string, object>
        {
            ["metrics"] = new Dictionary<string, object>
            {
                [metricEvent] = variantStats
            }
        });
    }

    private static string BuildStatsAnalysisJson(
        ReleaseDecisionExperimentRun run,
        string flagKey,
        string metricEvent,
        string metricType,
        string metricAgg,
        ExperimentStatsVm stats,
        IReadOnlyCollection<ExperimentVariantStatsVm> variants)
    {
        var totalUsers = variants.Sum(x => x.Users);
        var minimumSample = run.MinimumSample ?? 0;
        var status = variants.Count == 0 || totalUsers == 0
            ? "no_data"
            : variants.Any(x => x.Users < minimumSample)
                ? "insufficient_sample"
                : "stats_ready";

        var payload = new Dictionary<string, object?>
        {
            ["status"] = status,
            ["dataSource"] = "featbit-api-stats",
            ["flagKey"] = flagKey,
            ["metricEvent"] = metricEvent,
            ["metricType"] = metricType,
            ["metricAgg"] = metricAgg,
            ["window"] = stats.Window,
            ["minimumSample"] = minimumSample,
            ["totalUsers"] = totalUsers,
            ["variants"] = variants.Select(x => new Dictionary<string, object?>
            {
                ["variant"] = x.Variant,
                ["users"] = x.Users,
                ["conversions"] = x.Conversions,
                ["sumValue"] = x.SumValue,
                ["sumSquares"] = x.SumSquares,
                ["conversionRate"] = x.ConversionRate,
                ["avgValue"] = x.AvgValue
            }).ToArray()
        };

        return JsonSerializer.Serialize(payload);
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
}
