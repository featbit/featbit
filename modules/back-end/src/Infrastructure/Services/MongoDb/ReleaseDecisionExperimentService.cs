using Application.Bases.Exceptions;
using Application.Bases.Models;
using Application.ReleaseDecisions;
using Domain.ReleaseDecisions;
using MongoDB.Bson;
using MongoDB.Driver;

namespace Infrastructure.Services.MongoDb;

public class ReleaseDecisionExperimentService(MongoDbClient mongoDb) : IReleaseDecisionExperimentService
{
    public async Task<ReleaseDecisionExperimentVm> CreateAsync(ReleaseDecisionExperiment experiment)
    {
        await mongoDb.CollectionOf<ReleaseDecisionExperiment>().InsertOneAsync(experiment);
        return ToVm(experiment);
    }

    public async Task<ReleaseDecisionExperimentDetailVm> GetAsync(Guid envId, Guid id)
    {
        var experiment = await mongoDb.CollectionOf<ReleaseDecisionExperiment>()
            .Find(x => x.Id == id && x.FeatBitEnvId == envId)
            .FirstOrDefaultAsync();

        if (experiment == null)
        {
            throw new EntityNotFoundException(nameof(ReleaseDecisionExperiment), $"{envId}-{id}");
        }

        experiment.ExperimentRuns = await mongoDb.CollectionOf<ReleaseDecisionExperimentRun>()
            .Find(x => x.ExperimentId == id)
            .SortBy(x => x.CreatedAt)
            .ToListAsync();
        experiment.Activities = await mongoDb.CollectionOf<ReleaseDecisionActivity>()
            .Find(x => x.ExperimentId == id)
            .SortByDescending(x => x.CreatedAt)
            .ToListAsync();
        experiment.Messages = await mongoDb.CollectionOf<ReleaseDecisionMessage>()
            .Find(x => x.ExperimentId == id)
            .SortBy(x => x.CreatedAt)
            .ToListAsync();

        return ToDetailVm(experiment);
    }

    public async Task<Guid> GetEnvIdAsync(Guid id)
    {
        var envId = await mongoDb.CollectionOf<ReleaseDecisionExperiment>()
            .Find(x => x.Id == id)
            .Project(x => x.FeatBitEnvId)
            .FirstOrDefaultAsync();

        if (!envId.HasValue)
        {
            throw new EntityNotFoundException(nameof(ReleaseDecisionExperiment), id.ToString());
        }

        return envId.Value;
    }

    public async Task DeleteAsync(Guid envId, Guid id)
    {
        var result = await mongoDb.CollectionOf<ReleaseDecisionExperiment>()
            .DeleteOneAsync(x => x.Id == id && x.FeatBitEnvId == envId);

        if (result.DeletedCount == 0)
        {
            throw new EntityNotFoundException(nameof(ReleaseDecisionExperiment), $"{envId}-{id}");
        }

        await mongoDb.CollectionOf<ReleaseDecisionExperimentRun>().DeleteManyAsync(x => x.ExperimentId == id);
        await mongoDb.CollectionOf<ReleaseDecisionActivity>().DeleteManyAsync(x => x.ExperimentId == id);
        await mongoDb.CollectionOf<ReleaseDecisionMessage>().DeleteManyAsync(x => x.ExperimentId == id);
    }

    public async Task<ReleaseDecisionExperimentDetailVm> UpdateAsync(
        Guid envId,
        Guid id,
        ReleaseDecisionExperimentUpdate update)
    {
        update ??= new ReleaseDecisionExperimentUpdate();

        var updates = new List<UpdateDefinition<ReleaseDecisionExperiment>>
        {
            Builders<ReleaseDecisionExperiment>.Update.Set(x => x.UpdatedAt, DateTime.UtcNow)
        };

        SetIfNotNull(updates, x => x.Name, update.Name);
        SetIfNotNull(updates, x => x.Description, update.Description);
        SetIfNotNull(updates, x => x.Stage, update.Stage);
        SetIfNotNull(updates, x => x.FlagKey, update.FlagKey);
        SetIfNotNull(updates, x => x.Hypothesis, update.Hypothesis);
        SetIfNotNull(updates, x => x.AccessToken, update.AccessToken);
        SetIfNotNull(updates, x => x.Change, update.Change);
        SetIfNotNull(updates, x => x.Constraints, update.Constraints);
        SetIfNotNull(updates, x => x.EnvSecret, update.EnvSecret);
        SetIfNotNull(updates, x => x.FlagServerUrl, update.FlagServerUrl);
        SetIfNotNull(updates, x => x.Goal, update.Goal);
        SetIfNotNull(updates, x => x.Guardrails, update.Guardrails);
        SetIfNotNull(updates, x => x.Intent, update.Intent);
        SetIfNotNull(updates, x => x.LastAction, update.LastAction);
        SetIfNotNull(updates, x => x.LastLearning, update.LastLearning);
        SetIfNotNull(updates, x => x.OpenQuestions, update.OpenQuestions);
        SetIfNotNull(updates, x => x.PrimaryMetric, update.PrimaryMetric);
        SetIfNotNull(updates, x => x.SandboxId, update.SandboxId);
        SetIfNotNull(updates, x => x.Variants, update.Variants);
        SetIfNotNull(updates, x => x.ConflictAnalysis, update.ConflictAnalysis);
        SetIfNotNull(updates, x => x.EntryMode, update.EntryMode);

        await mongoDb.CollectionOf<ReleaseDecisionExperiment>().UpdateOneAsync(
            x => x.Id == id && x.FeatBitEnvId == envId,
            Builders<ReleaseDecisionExperiment>.Update.Combine(updates));

        return await GetAsync(envId, id);
    }

    public async Task<ReleaseDecisionExperimentDetailVm> UpdateStageAsync(
        Guid envId,
        Guid id,
        string stage)
    {
        return await UpdateAsync(envId, id, new ReleaseDecisionExperimentUpdate { Stage = stage });
    }

    public async Task<ReleaseDecisionExperimentDetailVm> UpdateMetricsAsync(
        Guid envId,
        Guid id,
        ReleaseDecisionMetricsUpdate update)
    {
        update ??= new ReleaseDecisionMetricsUpdate();

        var primaryMetric = string.IsNullOrWhiteSpace(update.MetricName) && string.IsNullOrWhiteSpace(update.MetricEvent)
            ? null
            : System.Text.Json.JsonSerializer.Serialize(new Dictionary<string, object>
            {
                ["name"] = update.MetricName?.Trim() ?? string.Empty,
                ["event"] = update.MetricEvent?.Trim() ?? string.Empty,
                ["metricType"] = update.MetricType == "continuous" || update.MetricType == "numeric" ? "continuous" : "binary",
                ["metricAgg"] = update.MetricAgg is "count" or "sum" or "average" ? update.MetricAgg : "once",
                ["expectedDirection"] = update.ExpectedDirection == "decrease_good" ? "decrease_good" : "increase_good",
                ["description"] = update.MetricDescription?.Trim() ?? string.Empty
            });

        return await UpdateAsync(envId, id, new ReleaseDecisionExperimentUpdate
        {
            PrimaryMetric = primaryMetric,
            Guardrails = update.Guardrails
        });
    }

    public async Task<ReleaseDecisionExperimentDetailVm> CreateRunAsync(Guid envId, Guid id)
    {
        await AddActivityAsync(id, $"New experiment run created: run-{DateTimeOffset.UtcNow.ToUnixTimeSeconds()}");
        return await GetAsync(envId, id);
    }

    public async Task<ReleaseDecisionExperimentDetailVm> DeleteRunAsync(Guid envId, Guid id, Guid runId)
    {
        await mongoDb.CollectionOf<ReleaseDecisionExperimentRun>().DeleteOneAsync(x => x.Id == runId && x.ExperimentId == id);
        await AddActivityAsync(id, "Experiment run deleted");
        return await GetAsync(envId, id);
    }

    public async Task<ReleaseDecisionExperimentDetailVm> UpdateRunAsync(
        Guid envId,
        Guid id,
        Guid runId,
        ReleaseDecisionExperimentRunUpdate update)
    {
        await AddActivityAsync(id, "Experiment run updated");
        return await GetAsync(envId, id);
    }

    public async Task<ReleaseDecisionExperimentDetailVm> UpdateRunAudienceAsync(
        Guid envId,
        Guid id,
        Guid runId,
        ReleaseDecisionExperimentRunAudienceUpdate update)
    {
        await AddActivityAsync(id, "Experiment run audience & traffic updated");
        return await GetAsync(envId, id);
    }

    public async Task<ReleaseDecisionExperimentDetailVm> UpdateRunObservationWindowAsync(
        Guid envId,
        Guid id,
        Guid runId,
        ReleaseDecisionExperimentRunObservationWindowUpdate update)
    {
        await AddActivityAsync(id, "Observation window updated");
        return await GetAsync(envId, id);
    }

    public async Task<ReleaseDecisionExperimentDetailVm> AnalyzeRunAsync(
        Guid envId,
        Guid id,
        Guid runId,
        ReleaseDecisionExperimentRunAnalyzeRequest request)
    {
        await AddActivityAsync(id, "Experiment run analyze requested");
        return await GetAsync(envId, id);
    }

    public async Task<ReleaseDecisionExperimentDetailVm> AddMessageAsync(
        Guid envId,
        Guid id,
        ReleaseDecisionExperimentMessageCreation creation)
    {
        creation ??= new ReleaseDecisionExperimentMessageCreation();
        if (string.IsNullOrWhiteSpace(creation.Content))
        {
            return await GetAsync(envId, id);
        }

        var role = creation.Role == "assistant" ? "assistant" : "user";
        await mongoDb.CollectionOf<ReleaseDecisionMessage>().InsertOneAsync(new ReleaseDecisionMessage
        {
            Id = Guid.NewGuid(),
            ExperimentId = id,
            Role = role,
            Content = creation.Content.Trim(),
            Metadata = creation.Metadata?.Trim() ?? string.Empty,
            CreatedAt = DateTime.UtcNow
        });

        await AddActivityAsync(
            id,
            role == "assistant" ? "Local Claude Code response recorded" : "Local Claude Code prompt recorded");
        return await GetAsync(envId, id);
    }

    public async Task<PagedResult<ReleaseDecisionExperimentVm>> GetListAsync(
        Guid envId,
        ReleaseDecisionExperimentFilter filter)
    {
        filter ??= new ReleaseDecisionExperimentFilter();

        var builder = Builders<ReleaseDecisionExperiment>.Filter;
        var filters = new List<FilterDefinition<ReleaseDecisionExperiment>>
        {
            builder.Eq(x => x.FeatBitEnvId, envId)
        };

        if (!string.IsNullOrWhiteSpace(filter.Name))
        {
            filters.Add(builder.Regex(x => x.Name, new BsonRegularExpression(filter.Name, "i")));
        }

        if (!string.IsNullOrWhiteSpace(filter.Stage))
        {
            filters.Add(builder.Eq(x => x.Stage, filter.Stage));
        }

        if (!string.IsNullOrWhiteSpace(filter.FlagKey))
        {
            filters.Add(builder.Regex(x => x.FlagKey, new BsonRegularExpression(filter.FlagKey, "i")));
        }

        var queryFilter = builder.And(filters);
        var collection = mongoDb.CollectionOf<ReleaseDecisionExperiment>();
        var totalCount = await collection.CountDocumentsAsync(queryFilter);
        var pageSize = filter.PageSize <= 0 ? 10 : filter.PageSize;
        var pageIndex = Math.Max(filter.PageIndex, 0);

        var experiments = await collection
            .Find(queryFilter)
            .SortByDescending(x => x.UpdatedAt)
            .ThenByDescending(x => x.CreatedAt)
            .Skip(pageIndex * pageSize)
            .Limit(pageSize)
            .ToListAsync();

        var runLookup = await BuildRunLookupAsync(experiments.Select(x => x.Id).ToArray());

        return new PagedResult<ReleaseDecisionExperimentVm>(
            totalCount,
            experiments.Select(experiment => ToVm(experiment, runLookup)).ToArray());
    }

    private async Task<Dictionary<Guid, string[]>> BuildRunLookupAsync(Guid[] experimentIds)
    {
        if (experimentIds.Length == 0)
        {
            return new Dictionary<Guid, string[]>();
        }

        return (await mongoDb.CollectionOf<ReleaseDecisionExperimentRun>()
                .Find(x => experimentIds.Contains(x.ExperimentId))
                .Project(x => new { x.ExperimentId, x.Method })
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

    private static ReleaseDecisionExperimentDetailVm ToDetailVm(ReleaseDecisionExperiment experiment)
    {
        return new ReleaseDecisionExperimentDetailVm
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
            ExperimentRuns = experiment.ExperimentRuns.Select(ToRunVm).ToArray(),
            Activities = experiment.Activities.Select(ToActivityVm).ToArray(),
            Messages = experiment.Messages.Select(ToMessageVm).ToArray()
        };
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

    private static void SetIfNotNull(
        List<UpdateDefinition<ReleaseDecisionExperiment>> updates,
        System.Linq.Expressions.Expression<Func<ReleaseDecisionExperiment, string>> field,
        string value)
    {
        if (value != null)
        {
            updates.Add(Builders<ReleaseDecisionExperiment>.Update.Set(field, value.Trim()));
        }
    }

    private async Task AddActivityAsync(Guid experimentId, string title)
    {
        await mongoDb.CollectionOf<ReleaseDecisionActivity>().InsertOneAsync(new ReleaseDecisionActivity
        {
            Id = Guid.NewGuid(),
            ExperimentId = experimentId,
            Type = "note",
            Title = title,
            CreatedAt = DateTime.UtcNow
        });
    }
}
