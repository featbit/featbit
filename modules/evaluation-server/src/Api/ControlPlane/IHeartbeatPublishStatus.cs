namespace Api.ControlPlane;

/// <summary>
/// D5 (#22) self-fence signal. A process-wide singleton recording when the
/// <see cref="HeartbeatService"/> last managed to publish a heartbeat to the control plane.
/// The <see cref="HeartbeatFreshnessHealthCheck"/> reads this to decide whether the pod has
/// likely been evicted / partitioned from the control plane (no successful publish for longer
/// than a threshold) and should report itself <c>Unhealthy</c> to operators.
/// </summary>
/// <remarks>
/// Under <c>GatedCommit</c> a stale heartbeat means the pod can no longer prove liveness to the
/// control plane, so it is fenced: the health check reports <c>Unhealthy</c>, which fails
/// <c>/health/readiness</c> and pulls the pod out of load-balancer rotation until heartbeats
/// resume. This is a hard fence (consistency over availability), not merely observational.
/// </remarks>
public interface IHeartbeatPublishStatus
{
    /// <summary>
    /// Timestamp of the most recent successful heartbeat publish, or <c>null</c> if the pod has
    /// not yet published a single heartbeat since startup.
    /// </summary>
    DateTimeOffset? LastSuccessfulPublishAt { get; }

    /// <summary>
    /// Records a successful heartbeat publish at <paramref name="at"/>, advancing
    /// <see cref="LastSuccessfulPublishAt"/>.
    /// </summary>
    void MarkSuccess(DateTimeOffset at);

    /// <summary>
    /// Records a failed heartbeat publish. The last-success timestamp is intentionally left
    /// unchanged so the freshness check measures age since the last <em>successful</em> publish.
    /// </summary>
    void MarkFailure(DateTimeOffset at);
}

/// <summary>
/// Thread-safe default <see cref="IHeartbeatPublishStatus"/>. Registered as a singleton so the
/// <see cref="HeartbeatService"/> (writer) and the <see cref="HeartbeatFreshnessHealthCheck"/>
/// (reader) share the same instance.
/// </summary>
public sealed class HeartbeatPublishStatus : IHeartbeatPublishStatus
{
    private long _lastSuccessTicks;
    private long _hasSucceeded;

    /// <inheritdoc />
    public DateTimeOffset? LastSuccessfulPublishAt
    {
        get
        {
            if (Interlocked.Read(ref _hasSucceeded) == 0)
            {
                return null;
            }

            var ticks = Interlocked.Read(ref _lastSuccessTicks);
            return new DateTimeOffset(ticks, TimeSpan.Zero);
        }
    }

    /// <inheritdoc />
    public void MarkSuccess(DateTimeOffset at)
    {
        Interlocked.Exchange(ref _lastSuccessTicks, at.UtcTicks);
        Interlocked.Exchange(ref _hasSucceeded, 1);
    }

    /// <inheritdoc />
    public void MarkFailure(DateTimeOffset at)
    {
        // Intentionally no-op on the last-success timestamp: a failure must not refresh freshness.
    }
}
