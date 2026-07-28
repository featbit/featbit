using System.Diagnostics.Metrics;
using Microsoft.Extensions.Diagnostics.HealthChecks;

namespace Api.Health;

/// <summary>
/// D5 (#22) self-fence / readiness signal. Reports whether this evaluation-server pod is still
/// able to publish heartbeats to the control plane.
/// </summary>
/// <remarks>
/// <para>
/// Behavior is mode-dependent:
/// <list type="bullet">
/// <item><b>BestEffort</b> — no-op: always <see cref="HealthStatus.Healthy"/>. Heartbeat freshness
/// is irrelevant when changes are not cross-DC gated.</item>
/// <item><b>GatedCommit</b> — when the pod has been unable to publish a heartbeat for longer than
/// <c>ControlPlane:HeartbeatStalenessThresholdSeconds</c> (it has likely been evicted / partitioned
/// from the control plane), report <see cref="HealthStatus.Unhealthy"/> — a HARD readiness fence.</item>
/// </list>
/// </para>
/// <para>
/// <b>Readiness (hard fence):</b> the ASP.NET Core health middleware maps <c>Unhealthy</c> to HTTP 503,
/// so this check is tagged for <c>/health/readiness</c> and an <c>Unhealthy</c> result FAILS readiness —
/// the pod is pulled from load-balancer rotation. This is the strict consistency-over-availability
/// choice: a partitioned/evicted DC's eval servers stop serving entirely rather than serving
/// stale-but-consistent values. It is tagged Readiness only (NOT liveness), so the pod is removed from
/// rotation, not restarted; it returns to rotation once heartbeats resume.
/// </para>
/// <para>
/// Also emits the <c>evaluation_server.consistency.heartbeat_staleness_seconds</c> observable gauge
/// (seconds since last successful publish; 0 when healthy) and logs a warning on the transition into
/// the unhealthy/fenced state.
/// </para>
/// </remarks>
public sealed class HeartbeatFreshnessHealthCheck : IHealthCheck
{
    /// <summary>
    /// Stable meter name for evaluation-server consistency observability. Mirrors the control
    /// plane's <c>FeatBit.ControlPlane.Consistency</c> meter naming.
    /// </summary>
    public const string MeterName = "FeatBit.EvaluationServer.Consistency";

    /// <summary>
    /// Seconds since this pod last successfully published a heartbeat (0 when fresh / healthy /
    /// not applicable). Operators alert on a sustained non-zero value under GatedCommit.
    /// </summary>
    public const string StalenessGaugeName = "evaluation_server.consistency.heartbeat_staleness_seconds";

    /// <summary>
    /// Default staleness threshold (seconds) when <c>ControlPlane:HeartbeatStalenessThresholdSeconds</c>
    /// is unset / non-positive. 15s = 3× <see cref="HeartbeatService.DefaultHeartbeatIntervalSeconds"/>
    /// (5s), i.e. a few missed heartbeats — long enough to avoid flapping on a single transient
    /// publish failure — and coincides with the control plane's default
    /// <c>ControlPlane:LeaseTtlSeconds</c> (15s), so this pod's readiness fence trips around the same
    /// time its DC lease would expire. #104: previously 180s (36× the interval, derived against the
    /// pre-#99 60s default), which left a partitioned pod serving ~165s longer than intended.
    /// </summary>
    public const int DefaultStalenessThresholdSeconds = 15;

    private static readonly Meter Meter = new(MeterName);

    // Most recent staleness (seconds), refreshed on every health-check evaluation. Static + volatile
    // so a single gauge registration survives across check instances and the gauge callback may run
    // on a different thread than the check evaluation.
    private static volatile int _stalenessSeconds;

    private static readonly ObservableGauge<long> StalenessGauge = Meter.CreateObservableGauge(
        StalenessGaugeName,
        () => (long)_stalenessSeconds,
        unit: "s",
        description:
        "Seconds since this evaluation-server pod last successfully published a heartbeat to the " +
        "control plane; 0 when healthy / not applicable (BestEffort).");

    private readonly IHeartbeatPublishStatus _status;
    private readonly IConfiguration _configuration;
    private readonly ILogger<HeartbeatFreshnessHealthCheck> _logger;
    private readonly Func<DateTimeOffset> _now;
    private readonly DateTimeOffset _startedAt;

    // Tracks the previous degraded state so the warning is logged only on the transition into
    // degraded (not on every poll while degraded persists).
    private int _wasDegraded;

    public HeartbeatFreshnessHealthCheck(
        IHeartbeatPublishStatus status,
        IConfiguration configuration,
        ILogger<HeartbeatFreshnessHealthCheck> logger)
        : this(status, configuration, logger, now: null)
    {
    }

    /// <summary>
    /// Testable constructor: <paramref name="now"/> injects the clock so freshness can be exercised
    /// without timers. When <paramref name="now"/> is supplied, the startup-grace baseline is the
    /// first value it returns.
    /// </summary>
    internal HeartbeatFreshnessHealthCheck(
        IHeartbeatPublishStatus status,
        IConfiguration configuration,
        ILogger<HeartbeatFreshnessHealthCheck> logger,
        Func<DateTimeOffset>? now)
    {
        _status = status;
        _configuration = configuration;
        _logger = logger;
        _now = now ?? (() => DateTimeOffset.UtcNow);
        _startedAt = _now();
    }

    public Task<HealthCheckResult> CheckHealthAsync(
        HealthCheckContext context,
        CancellationToken cancellationToken = default)
    {
        // BestEffort: heartbeat freshness is irrelevant — always healthy, gauge stays at 0.
        if (_configuration.GetConsistencyMode() != ConsistencyMode.GatedCommit)
        {
            _stalenessSeconds = 0;
            return Task.FromResult(HealthCheckResult.Healthy(
                "Heartbeat freshness not gating (BestEffort)."));
        }

        var thresholdSeconds = GetThresholdSeconds();
        var threshold = TimeSpan.FromSeconds(thresholdSeconds);
        var now = _now();
        var dcId = _configuration.GetDcId() ?? "(unset)";

        var lastSuccess = _status.LastSuccessfulPublishAt;

        TimeSpan age;
        if (lastSuccess.HasValue)
        {
            age = now - lastSuccess.Value;
        }
        else
        {
            // Never published since startup: measure from process start so a just-started pod gets
            // a startup grace equal to the threshold before it can be considered stale.
            age = now - _startedAt;
        }

        var ageSeconds = (int)Math.Max(0, age.TotalSeconds);
        _stalenessSeconds = ageSeconds;

        var isStale = age > threshold;

        if (!isStale)
        {
            Interlocked.Exchange(ref _wasDegraded, 0);

            var healthyMessage = lastSuccess.HasValue
                ? $"Heartbeat fresh: DcId={dcId}, {ageSeconds}s since last successful publish " +
                  $"(threshold {thresholdSeconds}s)."
                : $"Within startup grace: DcId={dcId}, {ageSeconds}s since start " +
                  $"(threshold {thresholdSeconds}s).";

            return Task.FromResult(HealthCheckResult.Healthy(healthyMessage));
        }

        var message = lastSuccess.HasValue
            ? $"Heartbeat stale: DcId={dcId} has not published a heartbeat for {ageSeconds}s " +
              $"(threshold {thresholdSeconds}s); pod likely evicted/partitioned from the control " +
              "plane. Failing readiness (pulled from rotation)."
            : $"No heartbeat published since startup: DcId={dcId}, {ageSeconds}s since start " +
              $"(threshold {thresholdSeconds}s); pod cannot reach the control plane. Failing " +
              "readiness (pulled from rotation).";

        // Log a warning only on the transition into the fenced state to avoid log spam.
        if (Interlocked.Exchange(ref _wasDegraded, 1) == 0)
        {
            _logger.LogWarning(
                "Heartbeat freshness unhealthy: DcId={DcId}, StalenessSeconds={StalenessSeconds}, " +
                "ThresholdSeconds={ThresholdSeconds}. Pod likely evicted/partitioned from the " +
                "control plane; failing readiness to pull it from rotation.",
                dcId, ageSeconds, thresholdSeconds);
        }

        return Task.FromResult(HealthCheckResult.Unhealthy(message));
    }

    private int GetThresholdSeconds()
    {
        var configured = _configuration.GetValue<int>("ControlPlane:HeartbeatStalenessThresholdSeconds");
        return configured > 0 ? configured : DefaultStalenessThresholdSeconds;
    }
}
