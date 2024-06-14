using Domain.Shared;

namespace Infrastructure.Fakes;

public class FakeStore : IStore
{
    public string Name => "Fake";

    public Task<bool> IsAvailableAsync() => Task.FromResult(true);

    public Task<IEnumerable<byte[]>> GetFlagsAsync(Guid envId, long timestamp)
    {
        return Task.FromResult(FakeData.AllFlags);
    }

    public Task<IEnumerable<byte[]>> GetFlagsAsync(IEnumerable<string> ids)
    {
        var flags = FakeData.FlagsMap.Where(x => ids.Contains(x.Key)).Select(x => x.Value);
        return Task.FromResult(flags);
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

    public Task<Secret?> GetSecretAsync(string secretString) => Task.FromResult(TestData.GetSecret(secretString));
}