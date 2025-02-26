using Domain.Shared;
using Infrastructure.Persistence.MongoDb;
using MongoDB.Bson;
using MongoDB.Driver;

namespace Infrastructure.Store;

public class MongoDbStore : IDbStore
{
    public string Name => Stores.MongoDb;

    private readonly IMongoDbClient _mongoDbClient;
    private readonly IMongoDatabase _mongodb;

    public MongoDbStore(IMongoDbClient mongoDbClient)
    {
        _mongoDbClient = mongoDbClient;
        _mongodb = mongoDbClient.Database;
    }

    public async Task<bool> IsAvailableAsync() => await _mongoDbClient.IsHealthyAsync();

    public async Task<IEnumerable<byte[]>> GetFlagsAsync(Guid envId, long timestamp)
    {
        var query = _mongodb.GetCollection<BsonDocument>("FeatureFlags")
            .Find(x => x["envId"].AsGuid == envId && x["updatedAt"] > DateTime.UnixEpoch.AddMilliseconds(timestamp));

        var flags = await query.ToListAsync();
        return flags.Select(x => x.ToJsonBytes());
    }

    public async Task<IEnumerable<byte[]>> GetFlagsAsync(IEnumerable<string> ids)
    {
        var query = _mongodb.GetCollection<BsonDocument>("FeatureFlags")
            .Find(x => ids.Select(Guid.Parse).Contains(x["_id"].AsGuid));

        var flags = await query.ToListAsync();
        return flags.Select(x => x.ToJsonBytes());
    }

    public async Task<byte[]> GetSegmentAsync(string id)
    {
        var query = _mongodb.GetCollection<BsonDocument>("Segments")
            .Find(x => x["_id"].AsGuid == Guid.Parse(id));

        var segment = await query.FirstAsync();
        return segment.ToJsonBytes();
    }

    public async Task<IEnumerable<byte[]>> GetSegmentsAsync(Guid envId, long timestamp)
    {
        var (envRN, wsId) = await GetEnvRNAndWorkspaceId();
        if (string.IsNullOrWhiteSpace(envRN) || wsId == Guid.Empty)
        {
            return [];
        }

        var query = _mongodb.GetCollection<BsonDocument>("Segments")
            .Find(x => x["updatedAt"] > DateTime.UnixEpoch.AddMilliseconds(timestamp) &&
                       x["workspaceId"].AsGuid == wsId &&
                       ((BsonArray)x["scopes"]).Any(y => $"{envRN}:".StartsWith(string.Concat(y, ":"))));

        var segments = await query.ToListAsync();
        foreach (var segment in segments)
        {
            segment["envId"] = new BsonBinaryData(envId, GuidRepresentation.Standard);
        }

        return segments.Select(x => x.ToJsonBytes());

        async Task<(string rn, Guid workspaceId)> GetEnvRNAndWorkspaceId()
        {
            var rnQuery = _mongodb.GetCollection<BsonDocument>("Organizations").Aggregate()
                .Lookup("Projects", "_id", "organizationId", "project")
                .Unwind("project")
                .Lookup("Environments", "project._id", "projectId", "env")
                .Unwind("env")
                .Match(x => x["env"]["_id"].AsGuid == envId)
                .Project(new BsonDocument
                {
                    {
                        "rn", new BsonDocument
                        {
                            {
                                "$concat", new BsonArray
                                {
                                    "organization/",
                                    "$key",
                                    ":project/",
                                    "$project.key",
                                    ":env/",
                                    "$env.key"
                                }
                            }
                        }
                    },
                    {
                        "workspaceId", "$workspaceId"
                    }
                });

            var document = await rnQuery.FirstOrDefaultAsync();
            var rn = document?["rn"].AsString ?? string.Empty;
            var workspaceId = document?["workspaceId"].AsGuid ?? Guid.Empty;

            return (rn, workspaceId);
        }
    }

    public async Task<Secret?> GetSecretAsync(string secretString)
    {
        if (!Secret.TryParse(secretString, out var envId))
        {
            return null;
        }

        var pipeline = new BsonDocument[]
        {
            new("$match", new BsonDocument("_id", new BsonBinaryData(envId, GuidRepresentation.Standard))),
            new("$lookup", new BsonDocument
            {
                { "from", "Projects" },
                { "localField", "projectId" },
                { "foreignField", "_id" },
                { "as", "project" }
            }),
            new("$unwind", "$project"),
            new("$project", new BsonDocument
            {
                { "project", new BsonDocument { { "key", "$project.key" } } },
                { "env", new BsonDocument { { "id", "$_id" }, { "key", "$key" }, { "secrets", "$secrets" } } }
            })
        };

        var query = _mongodb
            .GetCollection<BsonDocument>("Environments")
            .Aggregate<BsonDocument>(pipeline);

        var document = await query.FirstOrDefaultAsync();
        if (document is null)
        {
            return null;
        }

        var secret = document["env"]["secrets"].AsBsonArray.FirstOrDefault(x => x["value"] == secretString);
        if (secret == null)
        {
            return null;
        }

        return new Secret(
            secret["type"].AsString,
            document["project"]["key"].AsString,
            document["env"]["id"].AsGuid,
            document["env"]["key"].AsString
        );
    }
}