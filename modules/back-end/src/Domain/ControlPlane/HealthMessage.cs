#nullable enable

namespace Domain.ControlPlane;

public sealed record HealthMessage
{
    public required string PodId { get; init; }
    public DateTimeOffset Timestamp { get; init; }

    /// <summary>
    /// The region the pod is running in. Nullable so heartbeats produced before
    /// this field existed still deserialize.
    /// </summary>
    public string? Region { get; init; }

    /// <summary>
    /// The data center identifier the pod is running in. Nullable so heartbeats
    /// produced before this field existed still deserialize.
    /// </summary>
    public string? DcId { get; init; }

    /// <summary>
    /// The highest committed flag version (watermark) this pod has applied per
    /// environment, keyed by environment id. Nullable so heartbeats produced before
    /// this field existed still deserialize.
    /// </summary>
    public Dictionary<Guid, long>? AppliedWatermarks { get; init; }
}
