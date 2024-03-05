using Domain.Shared;
using Infrastructure.MongoDb;
using MongoDB.Bson;
using MongoDB.Driver;

namespace Infrastructure.Store;

public class MongoDbStore : IStore
{
    private readonly IMongoDatabase _mongodb;
    private static readonly BsonDocumentCommand<BsonDocument> Ping = new(BsonDocument.Parse("{ping:1}"));

    public MongoDbStore(IMongoDbClient mongoDbClient)
    {
        _mongodb = mongoDbClient.Database;
    }

    public async Task<bool> IsAvailableAsync()
    {
        try
        {
            await _mongodb.RunCommandAsync(Ping);
            return true;
        }
        catch (Exception)
        {
            return false;
        }
    }

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
        var query = _mongodb.GetCollection<BsonDocument>("Segments")
            .Find(x => x["envId"].AsGuid == envId && x["updatedAt"] > DateTime.UnixEpoch.AddMilliseconds(timestamp));

        var segments = await query.ToListAsync();
        return segments.Select(x => x.ToJsonBytes());
    }
}