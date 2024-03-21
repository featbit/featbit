using Domain.Shared;

namespace Infrastructure.Store;

public class NoneStore : IStore
{
    public virtual string Name => Stores.None;

    public virtual Task<bool> IsAvailableAsync() => Task.FromResult(true);

    public virtual Task<IEnumerable<byte[]>> GetFlagsAsync(Guid envId, long timestamp) =>
        Task.FromResult(Enumerable.Empty<byte[]>());

    public virtual Task<IEnumerable<byte[]>> GetFlagsAsync(IEnumerable<string> ids) =>
        Task.FromResult(Enumerable.Empty<byte[]>());

    public virtual Task<byte[]> GetSegmentAsync(string id) => Task.FromResult(Array.Empty<byte>());

    public virtual Task<IEnumerable<byte[]>> GetSegmentsAsync(Guid envId, long timestamp) =>
        Task.FromResult(Enumerable.Empty<byte[]>());

    public virtual Task<Secret?> GetSecretAsync(string secretString) => Task.FromResult<Secret?>(null);
}