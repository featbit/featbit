using Domain.AuditLogs;

namespace Domain.Segments;

/// <summary>
/// A staged-but-not-committed change to a <see cref="Segment"/>. Held alongside the
/// committed value so the authoritative (committed) read can ignore it until promotion.
/// </summary>
public class PendingSegmentChange
{
    /// <summary>
    /// Monotonic version this pending change will carry once it is promoted to committed.
    /// </summary>
    public long Version { get; set; }

    /// <summary>
    /// The staged segment value. This is NOT the authoritative value and must not be served
    /// until <see cref="Segment.PromotePending"/> makes it committed.
    /// </summary>
    public Segment Value { get; set; }

    // Attribution context captured at stage time (#73). Initializer values double as
    // backward-compat defaults: a pending row staged before these fields existed
    // deserializes to exactly the values the coordinator used to hardcode.
    public Guid OperatorId { get; set; }                       // Guid.Empty for legacy rows
    public string Operation { get; set; } = Operations.Update;
    public bool IsTargetingChange { get; set; } = true;
}
