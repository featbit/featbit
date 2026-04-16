using Application.Usages;
using Domain.Workspaces;
using MongoDB.Bson;
using MongoDB.Driver;
using MongoDB.Driver.Linq;

namespace Infrastructure.Services.MongoDb;

public class WorkspaceService(MongoDbClient mongoDb) : MongoDbService<Workspace>(mongoDb), IWorkspaceService
{
    public async Task<bool> HasKeyBeenUsedAsync(Guid workspaceId, string key)
    {
        return await AnyAsync(ws =>
            ws.Id != workspaceId &&
            string.Equals(ws.Key, key, StringComparison.OrdinalIgnoreCase)
        );
    }

    public async Task<string> GetDefaultWorkspaceAsync()
    {
        if (await Queryable.CountAsync() != 1)
        {
            return string.Empty;
        }

        var first = await Queryable.FirstAsync();
        return first.Key;
    }

    public async Task<int> GetFeatureUsageAsync(Guid workspaceId, string feature)
    {
        return feature switch
        {
            LicenseFeatures.AutoAgents => await GetAutoAgentsUsageAsync(),
            _ => 0
        };

        async Task<int> GetAutoAgentsUsageAsync()
        {
            var pipeline = new[]
            {
                new BsonDocument("$lookup", new BsonDocument
                {
                    { "from", "Organizations" },
                    { "localField", "organizationId" },
                    { "foreignField", "_id" },
                    { "as", "organization" }
                }),
                new BsonDocument("$unwind", "$organization"),
                new BsonDocument("$match", new BsonDocument
                {
                    { "organization.workspaceId", new BsonBinaryData(workspaceId, GuidRepresentation.Standard) }
                }),
                new BsonDocument("$project", new BsonDocument
                {
                    {
                        "autoAgentCount", new BsonDocument("$cond", new BsonDocument
                        {
                            { "if", new BsonDocument("$isArray", "$autoAgents") },
                            { "then", new BsonDocument("$size", "$autoAgents") },
                            { "else", 0 }
                        })
                    }
                }),
                new BsonDocument("$group", new BsonDocument
                {
                    { "_id", BsonNull.Value },
                    { "totalAutoAgents", new BsonDocument("$sum", "$autoAgentCount") }
                })
            };

            var result = await MongoDb.CollectionOf("RelayProxies")
                .Aggregate<BsonDocument>(pipeline)
                .FirstOrDefaultAsync();

            return result == null ? 0 : result["totalAutoAgents"].AsInt32;
        }
    }

    public async Task SaveRecordsAsync(AggregatedUsageRecords records)
    {
        var (recordedAt, endUsers, events) = records;
        var recordedDateTime = recordedAt.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);

        // Record each unique user once per month; $setOnInsert ensures firstSeenAt is never overwritten.
        if (endUsers.Count > 0)
        {
            var yearMonth = recordedAt.Year * 100 + recordedAt.Month;

            var mauCollection = MongoDb.CollectionOf("UsageEndUserStats");
            var mauUpdates = endUsers.SelectMany(kvp => kvp.Value.Select(userKey =>
                {
                    var envId = new BsonBinaryData(kvp.Key, GuidRepresentation.Standard);

                    var filter = Builders<BsonDocument>.Filter.And(
                        Builders<BsonDocument>.Filter.Eq("envId", envId),
                        Builders<BsonDocument>.Filter.Eq("yearMonth", yearMonth),
                        Builders<BsonDocument>.Filter.Eq("userKey", userKey)
                    );

                    var update = Builders<BsonDocument>.Update
                        .SetOnInsert("envId", envId)
                        .SetOnInsert("yearMonth", yearMonth)
                        .SetOnInsert("userKey", userKey)
                        .SetOnInsert("firstSeenAt", recordedDateTime);

                    return new UpdateOneModel<BsonDocument>(filter, update) { IsUpsert = true };
                })
            ).ToArray();

            if (mauUpdates.Length > 0)
            {
                await mauCollection.BulkWriteAsync(mauUpdates);
            }
        }

        // Accumulate daily flag evaluation and custom metric counts via $inc upsert.
        if (events.Count > 0)
        {
            var statsCollection = MongoDb.CollectionOf("UsageEventStats");

            var statsUpdates = events.Select(kvp =>
            {
                var filter = Builders<BsonDocument>.Filter.And(
                    Builders<BsonDocument>.Filter.Eq("envId", new BsonBinaryData(kvp.Key, GuidRepresentation.Standard)),
                    Builders<BsonDocument>.Filter.Eq("statsDate", recordedDateTime)
                );

                var update = Builders<BsonDocument>.Update
                    .Inc("flagEvaluations", kvp.Value.FlagEvaluations)
                    .Inc("customMetrics", kvp.Value.CustomMetrics);

                return new UpdateOneModel<BsonDocument>(filter, update) { IsUpsert = true };
            });

            await statsCollection.BulkWriteAsync(statsUpdates);
        }
    }
}