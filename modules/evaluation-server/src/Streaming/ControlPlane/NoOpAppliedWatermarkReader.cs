namespace Streaming.ControlPlane;

/// <summary>
/// <see cref="IAppliedWatermarkReader"/> that reports no watermarks and never touches Redis.
/// </summary>
/// <remarks>
/// The applied watermarks are consumed only under <c>ConsistencyMode.GatedCommit</c>, where the control plane turns
/// them into DC leases for the commit coordinator. Outside that mode nothing reads them, so the heartbeat does not
/// pay for building them: a pod with no connections would otherwise scan the whole Redis keyspace for environment ids
/// on every refresh.
/// </remarks>
public sealed class NoOpAppliedWatermarkReader : IAppliedWatermarkReader
{
    public Task<Dictionary<Guid, long>> ReadAsync(CancellationToken cancellationToken = default) =>
        Task.FromResult(new Dictionary<Guid, long>());
}
