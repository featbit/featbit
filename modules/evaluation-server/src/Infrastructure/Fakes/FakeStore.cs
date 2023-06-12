using Domain.Shared;

namespace Infrastructure.Fakes;

public class FakeStore : IStore
{
    public Task<IEnumerable<byte[]>> GetFlagsAsync(Guid envId, long timestamp)
    {
        return Task.FromResult(FakeData.AllFlags);
    }

    public Task<IEnumerable<byte[]>> GetFlagsAsync(IEnumerable<string> ids)
    {
        throw new NotImplementedException();
    }

    public Task<byte[]> GetSegmentAsync(string id)
    {
        var bytes = FakeData.SegmentsMap[id];
        return Task.FromResult(bytes);
    }

    public Task<IEnumerable<byte[]>> GetSegmentsAsync(Guid envId, long timestamp)
    {
        return Task.FromResult(FakeData.AllSegments);
    }
}