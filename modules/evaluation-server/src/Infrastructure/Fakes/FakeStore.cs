using Domain.Shared;

namespace Infrastructure.Fakes;

public class FakeStore : IDbStore
{
    public string Name => "Fake";

    public Task<bool> IsAvailableAsync() => Task.FromResult(true);

    public Task<IEnumerable<byte[]>> GetFlagsAsync(Guid envId, long timestamp)
    {
        var flags = FakeData.AllFlags.Where(x => x.Key > timestamp).Select(x => x.Value);

        return Task.FromResult(flags);
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
        var segments = FakeData.AllSegments.Where(x => x.Key > timestamp).Select(x => x.Value);

        return Task.FromResult(segments);
    }

    public Task<Secret?> GetSecretAsync(string secretString) => Task.FromResult(TestData.GetSecret(secretString));

    public static SecretWithValue[] GetRpSecrets(string key) => FakeData.GetRpSecrets(key);
}