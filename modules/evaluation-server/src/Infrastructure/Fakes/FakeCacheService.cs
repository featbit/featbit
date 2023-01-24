using System.Text.Json;
using Infrastructure.Caches;
using MongoDB.Bson;

namespace Infrastructure.Fakes;

public class FakeCacheService : ICacheService
{
    public Task<IEnumerable<byte[]>> GetFlagsAsync(Guid envId, long timestamp)
    {
        return Task.FromResult(FakeCache.Flags);
    }

    public Task<IEnumerable<byte[]>> GetFlagsAsync(IEnumerable<string> ids)
    {
        throw new NotImplementedException();
    }

    public Task UpsertFlagAsync(JsonElement flag)
    {
        throw new NotImplementedException();
    }

    public Task DeleteFlagAsync(Guid envId, Guid flagId)
    {
        throw new NotImplementedException();
    }

    public Task<byte[]> GetSegmentAsync(string id)
    {
        throw new NotImplementedException();
    }

    public Task<IEnumerable<byte[]>> GetSegmentsAsync(Guid envId, long timestamp)
    {
        return Task.FromResult(FakeCache.Segments);
    }

    public Task UpsertSegmentAsync(BsonDocument segment)
    {
        throw new NotImplementedException();
    }

    public Task UpsertSegmentAsync(JsonElement segment)
    {
        throw new NotImplementedException();
    }

    public Task DeleteSegmentAsync(Guid envId, Guid segmentId)
    {
        throw new NotImplementedException();
    }
}