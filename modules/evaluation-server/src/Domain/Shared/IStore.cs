namespace Domain.Shared;

public interface IStore
{
    Task<IEnumerable<byte[]>> GetFlagsAsync(Guid envId, long timestamp);

    Task<IEnumerable<byte[]>> GetFlagsAsync(IEnumerable<string> ids);

    Task<byte[]> GetSegmentAsync(string id);

    Task<IEnumerable<byte[]>> GetSegmentsAsync(Guid envId, long timestamp);
}