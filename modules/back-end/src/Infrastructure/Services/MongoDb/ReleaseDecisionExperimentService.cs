using Application.Bases.Models;
using Application.Bases.Exceptions;
using Application.ReleaseDecisions;
using Domain.ReleaseDecisions;
using MongoDB.Bson;
using MongoDB.Driver;

namespace Infrastructure.Services.MongoDb;

public class ReleaseDecisionExperimentService(MongoDbClient mongoDb) : IReleaseDecisionExperimentService
{
    public async Task<ReleaseDecisionExperimentVm> CreateAsync(ReleaseDecisionExperiment experiment)
    {
        var doc = new BsonDocument
        {
            ["_id"] = new BsonBinaryData(experiment.Id, GuidRepresentation.Standard),
            ["name"] = experiment.Name,
            ["description"] = experiment.Description ?? string.Empty,
            ["stage"] = experiment.Stage,
            ["flagKey"] = experiment.FlagKey ?? string.Empty,
            ["featBitProjectKey"] = experiment.FeatBitProjectKey ?? string.Empty,
            ["createdAt"] = experiment.CreatedAt,
            ["updatedAt"] = experiment.UpdatedAt
        };

        if (experiment.FeatBitEnvId.HasValue)
        {
            doc["featBitEnvId"] = new BsonBinaryData(experiment.FeatBitEnvId.Value, GuidRepresentation.Standard);
        }

        await mongoDb.CollectionOf("ReleaseDecisionExperiments").InsertOneAsync(doc);

        return ToVm(doc);
    }

    public async Task<ReleaseDecisionExperimentDetailVm> GetAsync(Guid envId, Guid id)
    {
        var collection = mongoDb.CollectionOf("ReleaseDecisionExperiments");
        var doc = await collection
            .Find(Builders<BsonDocument>.Filter.And(
                Builders<BsonDocument>.Filter.Eq("_id", id),
                Builders<BsonDocument>.Filter.Eq("featBitEnvId", envId)))
            .FirstOrDefaultAsync();

        if (doc == null)
        {
            throw new EntityNotFoundException(nameof(ReleaseDecisionExperiment), $"{envId}-{id}");
        }

        return ToDetailVm(doc);
    }

    public async Task<Guid> GetEnvIdAsync(Guid id)
    {
        var doc = await mongoDb.CollectionOf("ReleaseDecisionExperiments")
            .Find(Builders<BsonDocument>.Filter.Eq("_id", id))
            .Project(Builders<BsonDocument>.Projection.Include("featBitEnvId"))
            .FirstOrDefaultAsync();

        var envId = doc == null ? null : GetNullableGuid(doc, "featBitEnvId");
        if (!envId.HasValue)
        {
            throw new EntityNotFoundException(nameof(ReleaseDecisionExperiment), id.ToString());
        }

        return envId.Value;
    }

    public async Task DeleteAsync(Guid envId, Guid id)
    {
        var filter = Builders<BsonDocument>.Filter.And(
            Builders<BsonDocument>.Filter.Eq("_id", id),
            Builders<BsonDocument>.Filter.Eq("featBitEnvId", envId));

        var result = await mongoDb.CollectionOf("ReleaseDecisionExperiments")
            .DeleteOneAsync(filter);

        if (result.DeletedCount == 0)
        {
            throw new EntityNotFoundException(nameof(ReleaseDecisionExperiment), $"{envId}-{id}");
        }

        var experimentFilter = Builders<BsonDocument>.Filter.Eq("experimentId", id);
        await mongoDb.CollectionOf("ReleaseDecisionActivities").DeleteManyAsync(experimentFilter);
        await mongoDb.CollectionOf("ReleaseDecisionMessages").DeleteManyAsync(experimentFilter);
    }

    public async Task<ReleaseDecisionExperimentDetailVm> UpdateAsync(
        Guid envId,
        Guid id,
        ReleaseDecisionExperimentUpdate update)
    {
        update ??= new ReleaseDecisionExperimentUpdate();

        var updates = new List<UpdateDefinition<BsonDocument>>
        {
            Builders<BsonDocument>.Update.Set("updatedAt", DateTime.UtcNow)
        };

        SetIfNotNull(updates, "name", update.Name);
        SetIfNotNull(updates, "description", update.Description);
        SetIfNotNull(updates, "stage", update.Stage);
        SetIfNotNull(updates, "flagKey", update.FlagKey);
        SetIfNotNull(updates, "hypothesis", update.Hypothesis);
        SetIfNotNull(updates, "accessToken", update.AccessToken);
        SetIfNotNull(updates, "change", update.Change);
        SetIfNotNull(updates, "constraints", update.Constraints);
        SetIfNotNull(updates, "envSecret", update.EnvSecret);
        SetIfNotNull(updates, "flagServerUrl", update.FlagServerUrl);
        SetIfNotNull(updates, "goal", update.Goal);
        SetIfNotNull(updates, "guardrails", update.Guardrails);
        SetIfNotNull(updates, "intent", update.Intent);
        SetIfNotNull(updates, "lastAction", update.LastAction);
        SetIfNotNull(updates, "lastLearning", update.LastLearning);
        SetIfNotNull(updates, "openQuestions", update.OpenQuestions);
        SetIfNotNull(updates, "primaryMetric", update.PrimaryMetric);
        SetIfNotNull(updates, "sandboxId", update.SandboxId);
        SetIfNotNull(updates, "variants", update.Variants);
        SetIfNotNull(updates, "conflictAnalysis", update.ConflictAnalysis);
        SetIfNotNull(updates, "entryMode", update.EntryMode);

        var collection = mongoDb.CollectionOf("ReleaseDecisionExperiments");
        await collection.UpdateOneAsync(
            Builders<BsonDocument>.Filter.And(
                Builders<BsonDocument>.Filter.Eq("_id", id),
                Builders<BsonDocument>.Filter.Eq("featBitEnvId", envId)),
            Builders<BsonDocument>.Update.Combine(updates));

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
        await mongoDb.CollectionOf("ReleaseDecisionMessages").InsertOneAsync(new BsonDocument
        {
            ["_id"] = new BsonBinaryData(Guid.NewGuid(), GuidRepresentation.Standard),
            ["experimentId"] = new BsonBinaryData(id, GuidRepresentation.Standard),
            ["role"] = role,
            ["content"] = creation.Content.Trim(),
            ["metadata"] = creation.Metadata?.Trim() ?? string.Empty,
            ["createdAt"] = DateTime.UtcNow
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

        var collection = mongoDb.CollectionOf("ReleaseDecisionExperiments");
        var builder = Builders<BsonDocument>.Filter;
        var filters = new List<FilterDefinition<BsonDocument>>
        {
            builder.Eq("featBitEnvId", envId)
        };

        if (!string.IsNullOrWhiteSpace(filter.Name))
        {
            filters.Add(builder.Regex("name", new BsonRegularExpression(filter.Name, "i")));
        }

        if (!string.IsNullOrWhiteSpace(filter.Stage))
        {
            filters.Add(builder.Eq("stage", filter.Stage));
        }

        if (!string.IsNullOrWhiteSpace(filter.FlagKey))
        {
            filters.Add(builder.Regex("flagKey", new BsonRegularExpression(filter.FlagKey, "i")));
        }

        var queryFilter = builder.And(filters);
        var totalCount = await collection.CountDocumentsAsync(queryFilter);
        var pageSize = filter.PageSize <= 0 ? 10 : filter.PageSize;
        var pageIndex = Math.Max(filter.PageIndex, 0);

        var docs = await collection
            .Find(queryFilter)
            .Sort(Builders<BsonDocument>.Sort.Descending("updatedAt").Descending("createdAt"))
            .Skip(pageIndex * pageSize)
            .Limit(pageSize)
            .ToListAsync();

        return new PagedResult<ReleaseDecisionExperimentVm>(
            totalCount,
            docs.Select(ToVm).ToArray());
    }

    private static ReleaseDecisionExperimentVm ToVm(BsonDocument doc)
    {
        return new ReleaseDecisionExperimentVm
        {
            Id = GetGuid(doc, "_id"),
            Name = GetString(doc, "name"),
            Description = GetString(doc, "description"),
            Stage = GetString(doc, "stage"),
            FlagKey = GetString(doc, "flagKey"),
            FeatBitProjectKey = GetString(doc, "featBitProjectKey"),
            FeatBitEnvId = GetNullableGuid(doc, "featBitEnvId"),
            CreatedAt = GetDateTime(doc, "createdAt"),
            UpdatedAt = GetDateTime(doc, "updatedAt")
        };
    }

    private static ReleaseDecisionExperimentDetailVm ToDetailVm(BsonDocument doc)
    {
        var vm = new ReleaseDecisionExperimentDetailVm
        {
            Id = GetGuid(doc, "_id"),
            Name = GetString(doc, "name"),
            Description = GetString(doc, "description"),
            Stage = GetString(doc, "stage"),
            FlagKey = GetString(doc, "flagKey"),
            FeatBitProjectKey = GetString(doc, "featBitProjectKey"),
            FeatBitEnvId = GetNullableGuid(doc, "featBitEnvId"),
            Hypothesis = GetString(doc, "hypothesis"),
            AccessToken = GetString(doc, "accessToken"),
            Change = GetString(doc, "change"),
            Constraints = GetString(doc, "constraints"),
            EnvSecret = GetString(doc, "envSecret"),
            FlagServerUrl = GetString(doc, "flagServerUrl"),
            Goal = GetString(doc, "goal"),
            Guardrails = GetString(doc, "guardrails"),
            Intent = GetString(doc, "intent"),
            LastAction = GetString(doc, "lastAction"),
            LastLearning = GetString(doc, "lastLearning"),
            OpenQuestions = GetString(doc, "openQuestions"),
            PrimaryMetric = GetString(doc, "primaryMetric"),
            SandboxId = GetString(doc, "sandboxId"),
            SandboxStatus = GetString(doc, "sandboxStatus"),
            Variants = GetString(doc, "variants"),
            ConflictAnalysis = GetString(doc, "conflictAnalysis"),
            EntryMode = GetString(doc, "entryMode"),
            CreatedAt = GetDateTime(doc, "createdAt"),
            UpdatedAt = GetDateTime(doc, "updatedAt")
        };

        return vm;
    }

    private static void SetIfNotNull(List<UpdateDefinition<BsonDocument>> updates, string name, string value)
    {
        if (value != null)
        {
            updates.Add(Builders<BsonDocument>.Update.Set(name, value.Trim()));
        }
    }

    private async Task AddActivityAsync(Guid experimentId, string title)
    {
        await mongoDb.CollectionOf("ReleaseDecisionActivities").InsertOneAsync(new BsonDocument
        {
            ["_id"] = new BsonBinaryData(Guid.NewGuid(), GuidRepresentation.Standard),
            ["experimentId"] = new BsonBinaryData(experimentId, GuidRepresentation.Standard),
            ["type"] = "note",
            ["title"] = title,
            ["createdAt"] = DateTime.UtcNow
        });
    }

    private static string GetString(BsonDocument doc, string name)
    {
        return doc.TryGetValue(name, out var value) && value.IsString ? value.AsString : string.Empty;
    }

    private static Guid GetGuid(BsonDocument doc, string name)
    {
        if (!doc.TryGetValue(name, out var value))
        {
            return Guid.Empty;
        }

        return value.BsonType switch
        {
            BsonType.Binary => value.AsBsonBinaryData.ToGuid(),
            BsonType.String when Guid.TryParse(value.AsString, out var id) => id,
            _ => Guid.Empty
        };
    }

    private static Guid? GetNullableGuid(BsonDocument doc, string name)
    {
        var value = GetGuid(doc, name);
        return value == Guid.Empty ? null : value;
    }

    private static DateTime GetDateTime(BsonDocument doc, string name)
    {
        return doc.TryGetValue(name, out var value) && value.IsValidDateTime
            ? value.ToUniversalTime()
            : DateTime.MinValue;
    }
}
