namespace Domain.FeatureFlags;

/// <summary>
/// A staged-but-not-committed change to a <see cref="FeatureFlag"/>. Held alongside the
/// committed value so the authoritative (committed) read can ignore it until promotion.
/// </summary>
public class PendingFlagChange
{
    /// <summary>
    /// Monotonic version this pending change will carry once it is promoted to committed.
    /// </summary>
    public long Version { get; set; }

    /// <summary>
    /// The staged flag value. This is NOT the authoritative value and must not be served
    /// until <see cref="FeatureFlag.PromotePending"/> makes it committed.
    /// </summary>
    public FeatureFlag Value { get; set; }
}
