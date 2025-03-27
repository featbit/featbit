namespace Domain.Shared;

public class TestStore : IStore
{
    public string Name => "Test";

    public Task<bool> IsAvailableAsync() => Task.FromResult(true);

    public Task<IEnumerable<byte[]>> GetFlagsAsync(Guid envId, long timestamp) =>
        Task.FromResult(Enumerable.Empty<byte[]>());

    public Task<IEnumerable<byte[]>> GetFlagsAsync(IEnumerable<string> ids) =>
        Task.FromResult(Enumerable.Empty<byte[]>());

    public Task<byte[]> GetSegmentAsync(string id) => Task.FromResult(Array.Empty<byte>());

    public Task<IEnumerable<byte[]>> GetSegmentsAsync(Guid envId, long timestamp) =>
        Task.FromResult(Enumerable.Empty<byte[]>());

    public Task<Secret?> GetSecretAsync(string secretString) =>
        Task.FromResult(TestData.GetSecret(secretString));
}