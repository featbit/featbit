using MongoDB.Bson;
using System.Text.Json;

namespace Infrastructure.Caches;

public interface IRedisService
{
    Task<IEnumerable<byte[]>> GetFlagsAsync(Guid envId, long timestamp);

    Task<IEnumerable<byte[]>> GetFlagsAsync(IEnumerable<string> ids);

    Task UpsertFlagAsync(JsonElement flag);

    Task DeleteFlagAsync(Guid envId, Guid flagId);

    Task<byte[]> GetSegmentAsync(string id);

    Task<IEnumerable<byte[]>> GetSegmentsAsync(Guid envId, long timestamp);

    Task UpsertSegmentAsync(BsonDocument segment);

    Task UpsertSegmentAsync(JsonElement segment);

    Task DeleteSegmentAsync(Guid envId, Guid segmentId);
}