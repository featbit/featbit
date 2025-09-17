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

    public async Task<int> GetUsageAsync(Guid workspaceId, string feature)
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
}