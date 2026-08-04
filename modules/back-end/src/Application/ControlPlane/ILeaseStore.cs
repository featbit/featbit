using Domain.ControlPlane;

namespace Application.ControlPlane;

/// <summary>
/// Storage abstraction for data center (DC) membership leases used by the control plane.
/// Implementations back the live-set / eviction mechanism with a queryable membership record.
/// </summary>
public interface ILeaseStore
{
    /// <summary>
    /// Inserts or updates the lease for a data center.
    /// </summary>
    /// <param name="lease">The lease to persist.</param>
    Task UpsertLeaseAsync(DcLease lease);

    /// <summary>
    /// Returns the current live set of data center leases, that is, all members
    /// whose <see cref="DcLease.LeaseExpiresAt"/> is greater than <paramref name="now"/>.
    /// </summary>
    /// <param name="now">The reference time used to determine which leases are still live.</param>
    /// <returns>The members with <c>LeaseExpiresAt &gt; now</c>.</returns>
    Task<IReadOnlyList<DcLease>> GetLiveSetAsync(DateTimeOffset now);

    /// <summary>
    /// Updates the applied watermark (version) for a specific environment within a data center's lease.
    /// </summary>
    /// <param name="dcId">The data center id whose lease should be updated.</param>
    /// <param name="envId">The environment id whose watermark should be updated.</param>
    /// <param name="version">The applied version (watermark) to record.</param>
    Task UpdateAppliedWatermarkAsync(string dcId, Guid envId, long version);
}
