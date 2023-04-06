using Infrastructure.Caches;

namespace Infrastructure.Fakes;

public class FakeCacheService : ICacheService
{
    public Task<IEnumerable<byte[]>> GetFlagsAsync(Guid envId, long timestamp)
    {
        return Task.FromResult(FakeCache.AllFlags);
    }

    public Task<IEnumerable<byte[]>> GetFlagsAsync(IEnumerable<string> ids)
    {
        throw new NotImplementedException();
    }

    public Task<byte[]> GetSegmentAsync(string id)
    {
        var bytes = FakeCache.SegmentsMap[id];
        return Task.FromResult(bytes);
    }

    public Task<IEnumerable<byte[]>> GetSegmentsAsync(Guid envId, long timestamp)
    {
        return Task.FromResult(FakeCache.AllSegments);
    }
}