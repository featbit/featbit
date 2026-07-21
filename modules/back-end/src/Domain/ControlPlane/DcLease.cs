namespace Domain.ControlPlane;

/// <summary>
/// Represents a data center (DC) membership lease record used by the control plane
/// to track which DCs are currently live and what flag/segment versions they have applied.
/// </summary>
public class DcLease
{
    /// <summary>
    /// Unique identifier of the data center holding this lease.
    /// </summary>
    public string DcId { get; set; }

    /// <summary>
    /// Region the data center belongs to (for example, a geographic or cloud region).
    /// </summary>
    public string Region { get; set; }

    /// <summary>
    /// Timestamp of the most recent heartbeat received from this data center.
    /// </summary>
    public DateTimeOffset LastHeartbeatAt { get; set; }

    /// <summary>
    /// Timestamp at which this lease expires. A data center is considered live only
    /// while <see cref="LeaseExpiresAt"/> is in the future.
    /// </summary>
    public DateTimeOffset LeaseExpiresAt { get; set; }

    /// <summary>
    /// The highest applied watermark (version) per environment for this data center,
    /// keyed by environment id.
    /// </summary>
    public Dictionary<Guid, long> AppliedWatermarks { get; set; } = new();
}