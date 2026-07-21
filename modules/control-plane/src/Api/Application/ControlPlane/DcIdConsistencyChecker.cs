using System.Diagnostics.Metrics;
using Api.Infrastructure.Caches;
using Application;
using Application.ControlPlane;

namespace Api.Application.ControlPlane;

/// <summary>
/// #48 advisory DcId consistency check. The commit coordinator correlates a configured Redis
/// instance (<c>Redis:Instances[].DcId</c>) with the live ELS pods reporting leases in that DC
/// (<see cref="ILeaseStore.GetLiveSetAsync"/> -> <see cref="Domain.ControlPlane.DcLease.DcId"/>,
/// populated from each ELS pod's <c>ControlPlane:DcId</c>). If those DcId strings disagree, commits
/// silently stall for the affected DC: the configured DC is never seen "live" so its stage is never
/// gated on (typo), or an ELS pod reports a DcId the control plane never probes.
///
/// This worker periodically WARNS (never fails) when those two DcId sets diverge:
///  - a configured Redis DcId with NO reporting lease (DC down OR DcId typo), and
///  - a reporting lease whose DcId matches NO configured Redis instance (an ELS pod in a DC the
///    control plane does not know about).
///
/// It is a no-op unless <see cref="ConsistencyMode.GatedCommit"/> is active (only then do leases /
/// the gated commit path exist). Empty/ordinal-fallback configured DcIds (see
/// <see cref="CacheServiceCollectionExtensions"/>) carry no operator-meaningful identity and are
/// excluded from the comparison.
///
/// Advisory only: it changes no commit behavior. It logs and emits an observable gauge on the shared
/// <see cref="CommitCoordinatorWorker.MeterName"/> meter so operators can alert on a non-zero
/// unmatched-DC count.
///
/// #71b: this worker only runs its tick on the elected leader (<see cref="ILeaderElection"/>,
/// backed by <see cref="RedisLeaderElector"/>) when leader election is enabled; non-leaders skip the
/// tick entirely. When disabled (default — <c>ControlPlane:LeaderElection:Enabled</c>) every
/// instance runs — safe (advisory and idempotent) but redundant under multiple replicas. The check
/// is advisory and idempotent, so this is purely to avoid redundant work across replicas, not a
/// correctness requirement.
/// </summary>
public sealed class DcIdConsistencyChecker : BackgroundService
{
    /// <summary>
    /// Default interval between checks when not overridden via
    /// <c>ControlPlane:DcIdConsistency:IntervalSeconds</c>.
    /// </summary>
    public static readonly TimeSpan DefaultInterval = TimeSpan.FromSeconds(60);

    /// <summary>
    /// #48: observable gauge reporting the count of unmatched DCs, tagged <c>direction</c> =
    /// <c>missing_lease</c> (configured DcId has no reporting lease) | <c>unknown_dc</c> (reporting
    /// lease's DcId matches no configured Redis instance). Emitted on the shared consistency meter
    /// (<see cref="CommitCoordinatorWorker.MeterName"/>).
    /// </summary>
    public const string UnmatchedDcCountGaugeName = "control_plane.consistency.unmatched_dc_count";

    private static readonly Meter Meter = new(CommitCoordinatorWorker.MeterName);

    /// <summary>One (direction, count) row captured for the unmatched-DC-count gauge below.</summary>
    private readonly record struct DirectionCount(string Direction, long Count);

    // Most recent unmatched counts, refreshed at the end of each tick, via the shared
    // ObservableGaugeSnapshot helper (#108 item 5; previously a hand-rolled pair of static volatile
    // ints + an ObservableGauge iterator method, matching what CommitCoordinatorWorker had).
    private static readonly ObservableGaugeSnapshot<DirectionCount> UnmatchedDcCountSnapshot = new(
        m => new Measurement<long>(m.Count, new KeyValuePair<string, object?>("direction", m.Direction)));

    private static readonly ObservableGauge<long> UnmatchedDcCountGauge = UnmatchedDcCountSnapshot.CreateGauge(
        Meter,
        UnmatchedDcCountGaugeName,
        unit: "{dc}",
        description:
        "Count of DCs whose configured Redis DcId and reporting ELS lease DcId do not line up, " +
        "tagged direction = missing_lease | unknown_dc.");

    private readonly IServiceScopeFactory _scopeFactory;
    private readonly IConfiguration _configuration;
    private readonly ILeaderElection _leaderElection;
    private readonly bool _enabled;
    private readonly TimeSpan _interval;
    private readonly ILogger<DcIdConsistencyChecker> _logger;

    public DcIdConsistencyChecker(
        IServiceScopeFactory scopeFactory,
        IConfiguration configuration,
        ILeaderElection leaderElection,
        ILogger<DcIdConsistencyChecker> logger)
    {
        _scopeFactory = scopeFactory;
        _configuration = configuration;
        _leaderElection = leaderElection;
        _logger = logger;
        _enabled = configuration.GetConsistencyMode() == ConsistencyMode.GatedCommit;

        var seconds = configuration.GetValue<int?>("ControlPlane:DcIdConsistency:IntervalSeconds");
        _interval = seconds is > 0
            ? TimeSpan.FromSeconds(seconds.Value)
            : DefaultInterval;
    }

    /// <summary>
    /// Result of comparing the configured Redis DcId set against the reporting lease DcId set.
    /// </summary>
    /// <param name="MissingLeases">
    /// Configured Redis DcIds with NO reporting lease (DC down OR DcId typo), sorted, deduplicated.
    /// </param>
    /// <param name="UnknownDcs">
    /// Reporting lease DcIds matching NO configured Redis instance (an unknown DC), sorted,
    /// deduplicated.
    /// </param>
    public sealed record ComparisonResult(
        IReadOnlyList<string> MissingLeases,
        IReadOnlyList<string> UnknownDcs)
    {
        public bool HasMismatch => MissingLeases.Count > 0 || UnknownDcs.Count > 0;
    }

    /// <summary>
    /// Pure comparison of configured Redis DcIds against reporting lease DcIds. Empty/whitespace
    /// configured DcIds are excluded (they are ordinal-fallback placeholders with no operator
    /// identity). Comparison is ordinal (case-sensitive), matching the default <see cref="HashSet{T}"/>
    /// semantics the lease live-set uses elsewhere, so a case typo surfaces as a genuine mismatch.
    /// Results are deduplicated and sorted for stable log output. Pure / side-effect-free so it can
    /// be unit-tested without any infrastructure.
    /// </summary>
    public static ComparisonResult Compare(
        IEnumerable<string?> configuredDcIds,
        IEnumerable<string?> reportingDcIds)
    {
        var configured = configuredDcIds
            .Where(id => !string.IsNullOrWhiteSpace(id))
            .Select(id => id!)
            .ToHashSet(StringComparer.Ordinal);

        var reporting = reportingDcIds
            .Where(id => !string.IsNullOrWhiteSpace(id))
            .Select(id => id!)
            .ToHashSet(StringComparer.Ordinal);

        var missingLeases = configured
            .Where(dc => !reporting.Contains(dc))
            .OrderBy(dc => dc, StringComparer.Ordinal)
            .ToList();

        var unknownDcs = reporting
            .Where(dc => !configured.Contains(dc))
            .OrderBy(dc => dc, StringComparer.Ordinal)
            .ToList();

        return new ComparisonResult(missingLeases, unknownDcs);
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (!_enabled)
        {
            _logger.LogInformation(
                "DcId consistency checker disabled (consistency mode is not GatedCommit).");
            return;
        }

        using var timer = new PeriodicTimer(_interval);
        while (await timer.WaitForNextTickAsync(stoppingToken))
        {
            try
            {
                await RunOnceAsync(stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                // ignore cancellation from the timer loop itself
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error occurred while running the DcId consistency check tick.");
            }
        }
    }

    /// <summary>
    /// Performs a single check tick: reads the configured Redis DcIds and the reporting lease DcIds,
    /// compares them, warns on each mismatch, and refreshes the unmatched-DC gauge. Returns the
    /// comparison result, or <c>null</c> if this instance is not the elected leader (see #71b gate
    /// below) — meaning the tick was skipped entirely, not that no mismatch was found. Exposed so it
    /// can be invoked directly (e.g. by integration tests) without waiting on the periodic timer.
    /// </summary>
    public async Task<ComparisonResult?> RunOnceAsync(CancellationToken cancellationToken = default)
    {
        // #71b: only the elected leader runs the tick. Non-leaders skip entirely (Debug — this is
        // expected steady-state on every non-leader replica, not an error).
        //
        // #105: also RESET the gauge snapshot here. The ObservableGauge callback reads this snapshot
        // on every export with no leader filter of its own, and it is refreshed only AFTER this
        // gate — so a replica that loses leadership would otherwise keep exporting its stale
        // last-leader snapshot indefinitely. Latent today (no exporter wired up), but activates the
        // moment metrics are exported from more than one replica.
        if (!_leaderElection.ShouldRunAsLeader(_logger, "DcId consistency checker"))
        {
            UnmatchedDcCountSnapshot.Reset();
            return null;
        }

        // The configured DcIds are read from the SAME Redis:Instances section the cache extension
        // binds (see CacheServiceCollectionExtensions.AddRedis). Empty DcIds are ordinal-fallback
        // placeholders and are excluded by Compare.
        var configuredDcIds = _configuration
            .GetSection("Redis:Instances")
            .Get<RedisInstanceConfig[]>()?
            .Select(instance => instance.DcId)
            ?? [];

        // ILeaseStore is scoped (per-request) in DI; resolve it inside a scope so the singleton
        // BackgroundService does not capture a scoped/disposed instance (mirrors the coordinator).
        using var scope = _scopeFactory.CreateScope();
        var leaseStore = scope.ServiceProvider.GetRequiredService<ILeaseStore>();

        var liveSet = await leaseStore.GetLiveSetAsync(DateTimeOffset.UtcNow);
        cancellationToken.ThrowIfCancellationRequested();

        var reportingDcIds = liveSet.Select(lease => lease.DcId);

        var result = Compare(configuredDcIds, reportingDcIds);

        // Refresh the observable gauge from this tick regardless of mismatch, so a return to a
        // matched state resets the reported count back to zero.
        UnmatchedDcCountSnapshot.Update(
        [
            new DirectionCount("missing_lease", result.MissingLeases.Count),
            new DirectionCount("unknown_dc", result.UnknownDcs.Count)
        ]);

        if (result.MissingLeases.Count > 0)
        {
            _logger.LogWarning(
                "DcId consistency: configured Redis DC(s) {MissingDcs} have no reporting ELS lease " +
                "(the DC is down OR its configured DcId does not match the ELS ControlPlane:DcId). " +
                "Commits will stall for these DC(s) until a matching lease is reported.",
                string.Join(", ", result.MissingLeases));
        }

        if (result.UnknownDcs.Count > 0)
        {
            _logger.LogWarning(
                "DcId consistency: ELS pod(s) report lease DC(s) {UnknownDcs} that match no " +
                "configured Redis instance (an unknown DC the control plane cannot stage to). " +
                "Add a Redis:Instances entry with a matching DcId, or fix the ELS ControlPlane:DcId.",
                string.Join(", ", result.UnknownDcs));
        }

        return result;
    }
}
