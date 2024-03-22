using Domain.Shared;

namespace Infrastructure.Store;

public class NoneStore : IStore
{
    public string Name => Stores.None;

    public Task<bool> IsAvailableAsync() => Task.FromResult(false);

    public Task<IEnumerable<byte[]>> GetFlagsAsync(Guid envId, long timestamp) =>
        throw new NotImplementedException();

    public Task<IEnumerable<byte[]>> GetFlagsAsync(IEnumerable<string> ids) =>
        throw new NotImplementedException();

    public Task<byte[]> GetSegmentAsync(string id) =>
        throw new NotImplementedException();

    public Task<IEnumerable<byte[]>> GetSegmentsAsync(Guid envId, long timestamp) =>
        throw new NotImplementedException();

    public Task<Secret?> GetSecretAsync(string secretString) =>
        throw new NotImplementedException();
}