using System.Diagnostics.Metrics;

namespace Api.Application.ControlPlane;

/// <summary>
/// #71 leader election is opt-in (default off, <c>ControlPlane:LeaderElection:Enabled</c>): this is
/// the <see cref="ILeaderElection"/> served to the gated-commit workers instead of
/// <see cref="RedisLeaderElector"/> while election is disabled.
///
/// Election only matters when MULTIPLE replicas of one control-plane deployment share a single
/// commit pipeline. For the default single-replica case it adds a stall surface for zero benefit —
/// a transient Redis blip flips <c>IsLeader</c> to false and the gated workers skip ticks even
/// though there is no other replica to hand off to. Running without election is safe-but-redundant
/// by construction: every operation the gated workers perform is idempotent/version-guarded (see
/// <see cref="RedisLeaderElector"/>'s class doc), so every instance just running every tick is
/// correct, at worst duplicating work across replicas. This mirrors the codebase's existing opt-in
/// convention (<c>ConsistencyMode</c> itself defaults to <c>BestEffort</c>).
///
/// Always reports leadership, so callers that gate on <see cref="ILeaderElection.IsLeader"/>
/// (<see cref="LeaderElectionExtensions.ShouldRunAsLeader"/>) never skip a tick because of this type.
///
/// Implements <see cref="IHostedService"/> (there is no loop to run — unlike
/// <see cref="RedisLeaderElector"/>, which is a <see cref="BackgroundService"/>) purely so
/// <see cref="StartAsync"/> can log one discoverability hint at startup pointing operators at the
/// config knob if they are actually running multiple replicas.
///
/// Still emits the <see cref="RedisLeaderElector.IsLeaderGaugeName"/> gauge (same name and
/// <c>instance_id</c> tag as <see cref="RedisLeaderElector"/>), pinned at a constant 1, so
/// dashboards built against that metric keep reporting a "leader" reading per instance instead of
/// the series disappearing when election is disabled.
/// </summary>
public sealed class AlwaysLeaderElection : ILeaderElection, IHostedService, IDisposable
{
    private readonly ILogger<AlwaysLeaderElection> _logger;
    private readonly Meter _meter;
    private readonly ObservableGauge<int> _isLeaderGauge;

    /// <inheritdoc />
    public Guid InstanceId { get; } = Guid.NewGuid();

    /// <inheritdoc />
    public bool IsLeader => true;

    public AlwaysLeaderElection(ILogger<AlwaysLeaderElection> logger)
    {
        _logger = logger;

        // Instance-owned Meter, same pattern (and same rationale) as RedisLeaderElector: the meter
        // NAME is reused so operators see one logical metric regardless of which implementation is
        // active, but the registration is per-instance.
        _meter = new Meter(CommitCoordinatorWorker.MeterName);
        _isLeaderGauge = _meter.CreateObservableGauge(
            RedisLeaderElector.IsLeaderGaugeName,
            ObserveIsLeader,
            unit: "{leader}",
            description: "1 if this control-plane instance currently holds the leader lock, else 0.");
    }

    private Measurement<int> ObserveIsLeader() =>
        new(1, new KeyValuePair<string, object?>("instance_id", InstanceId.ToString()));

    /// <summary>
    /// Logs a single discoverability hint, then completes immediately — there is no election loop
    /// to run while leader election is disabled.
    /// </summary>
    public Task StartAsync(CancellationToken cancellationToken)
    {
        _logger.LogInformation(
            "Leader election disabled (ControlPlane:LeaderElection:Enabled=false); if running " +
            "multiple control-plane replicas, enable it to avoid redundant work.");
        return Task.CompletedTask;
    }

    public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;

    public void Dispose() => _meter.Dispose();
}
