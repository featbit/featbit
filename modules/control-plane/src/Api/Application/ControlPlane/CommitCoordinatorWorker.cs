using System.Diagnostics.Metrics;
using Application.Caches;
using Application.ControlPlane;
using Application.Segments;
using Application.Services;
using Api.Infrastructure.Caches;
using Application;
using Domain.AuditLogs;
using Domain.ControlPlane;
using Domain.Messages;
using Domain.Segments;

namespace Api.Application.ControlPlane;

/// <summary>
/// C3b-2 commit coordinator. Under <see cref="ConsistencyMode.GatedCommit"/> this periodically
/// reconciles pending (staged-but-not-committed) flag AND segment changes: a pending version is
/// committed (its committed pointer/index advanced in every DC's Redis, the Mongo/EF pending
/// promoted to committed, and the change published to the evaluation-server topic) only once
/// EVERY currently live DC has that exact version staged in its own Redis.
///
/// Gate model (locked design): the control plane probes each live DC's Redis directly
/// (<see cref="CompositeRedisCacheService.GetStagedDcsAsync"/> for flags,
/// <see cref="CompositeRedisCacheService.GetStagedSegmentDcsAsync"/> for segments) — "live" = a DC
/// with at least one unexpired lease in <see cref="ILeaseStore"/>. The pending sets are enumerated
/// via DB scans (<see cref="IFeatureFlagService.GetPendingAsync"/> /
/// <see cref="ISegmentService.GetPendingAsync"/>); commit granularity is per-flag / per-segment.
///
/// Segments (S3 / #17): committing a segment additionally replays the affected-flags propagation
/// that <see cref="SegmentChangeMessageHandler"/>'s BestEffort branch performs inline at handle
/// time. The staged pending change now carries the attribution context captured at stage time
/// (<see cref="PendingSegmentChange.OperatorId"/> / <see cref="PendingSegmentChange.Operation"/> /
/// <see cref="PendingSegmentChange.IsTargetingChange"/>, #73), so the coordinator reconstructs an
/// <see cref="OnSegmentChange"/> from the committed segment using that persisted attribution
/// (legacy pending rows staged before #73 default to Operator = Guid.Empty, Operation = Update,
/// IsTargetingChange = true — today's prior hardcoded behavior) so
/// <see cref="ISegmentMessageService.GetAffectedFlagsAsync"/> recomputes the affected flags, then
/// (if any) calls <see cref="IFeatureFlagAppService.OnSegmentUpdatedAsync"/> and finally
/// <see cref="ISegmentMessageService.PublishSegmentChangeMessage"/> per env — exactly the
/// BestEffort sequence, deferred to commit time.
///
/// Idempotent + crash-safe: re-running a tick is a no-op once a flag/segment is committed — the
/// commit broadcast and the version-guarded promote both no-op when already applied.
///
/// #71b: this worker only runs its tick on the elected leader (<see cref="ILeaderElection"/>,
/// backed by <see cref="RedisLeaderElector"/>) when leader election is enabled; non-leaders skip the
/// tick entirely. When disabled (default — <c>ControlPlane:LeaderElection:Enabled</c>) every
/// instance runs — safe (idempotent/version guards, see above) but redundant under multiple
/// replicas. Idempotency guards (see above) still make concurrent execution safe belt-and-braces
/// during a failover overlap window, so losing leadership mid-tick is harmless.
///
/// Metrics (all on <see cref="MeterName"/>): <see cref="CommitsCounterName"/>,
/// <see cref="TimeToCommitHistogramName"/>, <see cref="PendingBacklogGaugeName"/>,
/// <see cref="EvictedCommitCounterName"/>, and (#84) <see cref="AppliedWatermarkLagGaugeName"/> —
/// each live DC's lag behind the most-advanced live DC's applied watermark, per env.
/// </summary>
public sealed class CommitCoordinatorWorker : BackgroundService
{
    /// <summary>
    /// Default interval between coordinator ticks when not overridden via
    /// <c>ControlPlane:CommitCoordinator:IntervalSeconds</c>.
    /// </summary>
    public static readonly TimeSpan DefaultInterval = TimeSpan.FromSeconds(5);

    /// <summary>
    /// Stable meter name for control-plane consistency observability. Operators / tests subscribe
    /// to this meter (e.g. via <see cref="MeterListener"/> or <c>IMeterFactory</c>) to observe the
    /// eviction counters emitted by the commit coordinator.
    /// </summary>
    public const string MeterName = "FeatBit.ControlPlane.Consistency";

    /// <summary>
    /// Counter incremented once per (flag-commit, evicted DC) pair: i.e. every time a flag version
    /// is committed while a configured DC is absent from the live set (its lease expired / it is
    /// down). Tagged with the evicted <c>dc_id</c>.
    /// </summary>
    public const string EvictedCommitCounterName = "control_plane.consistency.evicted_commits";

    /// <summary>
    /// F1 (#24): counter incremented once per successful commit (flag OR segment). Tagged
    /// <c>resource_type</c> = <c>flag</c> | <c>segment</c> (and <c>env_id</c> on the flag path, cheaply
    /// available from the pending flag record).
    /// </summary>
    public const string CommitsCounterName = "control_plane.consistency.commits";

    /// <summary>
    /// F1 (#24): histogram of the stage-to-commit latency in milliseconds, recorded at each commit as
    /// <c>now - resourceUpdatedAt</c> (the resource's <c>UpdatedAt</c> is the staged version's
    /// timestamp, so this approximates stage->commit latency). Tagged <c>resource_type</c>.
    /// </summary>
    public const string TimeToCommitHistogramName = "control_plane.consistency.time_to_commit_ms";

    /// <summary>
    /// F1 (#24): observable gauge reporting the count of currently-pending (staged-but-not-committed)
    /// items per <c>resource_type</c> = <c>flag</c> | <c>segment</c>. Backed by fields refreshed at the
    /// end of each <see cref="RunOnceAsync"/> from the latest <c>GetPendingAsync</c> reads.
    /// </summary>
    public const string PendingBacklogGaugeName = "control_plane.consistency.pending_backlog";

    private static readonly Meter Meter = new(MeterName);

    private static readonly Counter<long> EvictedCommitCounter = Meter.CreateCounter<long>(
        EvictedCommitCounterName,
        unit: "{commit}",
        description:
        "Number of flag-version commits made while a configured DC was evicted (absent from the live set).");

    private static readonly Counter<long> CommitsCounter = Meter.CreateCounter<long>(
        CommitsCounterName,
        unit: "{commit}",
        description: "Number of successful commits, tagged by resource_type (flag | segment).");

    private static readonly Histogram<double> TimeToCommitHistogram = Meter.CreateHistogram<double>(
        TimeToCommitHistogramName,
        unit: "ms",
        description:
        "Stage-to-commit latency (now - resource UpdatedAt) in milliseconds, tagged by resource_type.");

    /// <summary>One (resource_type, count) row captured for the pending-backlog gauge below.</summary>
    private readonly record struct ResourceTypeCount(string ResourceType, long Count);

    // Observable backlog gauge: reports the most recent pending counts captured at the end of a
    // tick, via the shared ObservableGaugeSnapshot helper (#108 item 5; previously a hand-rolled
    // pair of static volatile ints + an ObservableGauge iterator method).
    private static readonly ObservableGaugeSnapshot<ResourceTypeCount> PendingBacklogSnapshot = new(
        m => new Measurement<long>(m.Count, new KeyValuePair<string, object?>("resource_type", m.ResourceType)));

    private static readonly ObservableGauge<long> PendingBacklogGauge = PendingBacklogSnapshot.CreateGauge(
        Meter,
        PendingBacklogGaugeName,
        unit: "{item}",
        description: "Currently-pending (staged-but-not-committed) item count per resource_type.");

    /// <summary>
    /// #84 (sub-issue of #69): observable gauge reporting each live DC's lag, in milliseconds, behind
    /// the most-advanced live DC's applied watermark, per env. Tagged <c>dc_id</c>, <c>env_id</c>.
    /// Backed by a snapshot refreshed at the start of each tick (see
    /// <see cref="RefreshAppliedWatermarkLagSnapshot"/>) from <see cref="ILeaseStore.GetLiveSetAsync"/>
    /// — self-contained from the live set the coordinator already loads every tick, independent of
    /// pending flags/segments and of the commit decision.
    /// </summary>
    public const string AppliedWatermarkLagGaugeName = "control_plane.consistency.applied_watermark_lag_ms";

    /// <summary>
    /// One (dc_id, env_id, lag_ms) measurement captured by <see cref="RefreshAppliedWatermarkLagSnapshot"/>.
    /// </summary>
    private readonly record struct AppliedWatermarkLagMeasurement(string DcId, Guid EnvId, long LagMs);

    // Observable applied-watermark-lag gauge: reports the per-(dc, env) lag captured at the start of
    // the most recent tick, via the shared ObservableGaugeSnapshot helper (#108 item 5).
    private static readonly ObservableGaugeSnapshot<AppliedWatermarkLagMeasurement> AppliedWatermarkLagSnapshot = new(
        m => new Measurement<long>(
            m.LagMs,
            new KeyValuePair<string, object?>("dc_id", m.DcId),
            new KeyValuePair<string, object?>("env_id", m.EnvId.ToString())));

    private static readonly ObservableGauge<long> AppliedWatermarkLagGauge = AppliedWatermarkLagSnapshot.CreateGauge(
        Meter,
        AppliedWatermarkLagGaugeName,
        unit: "ms",
        description:
        "Per-DC lag (ms) behind the most-advanced live DC's applied watermark, per env " +
        "(frontier(env) - dc's watermark(env)).");

    /// <summary>
    /// #84: recompute the per-(dc, env) applied-watermark-lag snapshot from this tick's live set.
    /// There is no materialized per-env committed frontier in the control plane, and none is
    /// needed: per env, <c>frontier(env) = max over live DCs of lease.AppliedWatermarks[env]</c>,
    /// and <c>lag(dc, env) = frontier(env) - lease.AppliedWatermarks[env]</c> — the most-advanced DC
    /// reads 0, stragglers read their delay in ms (watermarks are unix-ms on the same clock as
    /// pending versions). Only (dc, env) pairs where that DC actually has a watermark entry are
    /// reported — a DC with no connections/data for an env doesn't serve it, and inventing
    /// <c>lag = frontier - 0</c> would be misleading. An empty live set, or a live set where no DC
    /// reports any watermark, yields an empty snapshot (the gauge then reports no measurements).
    /// </summary>
    private static void RefreshAppliedWatermarkLagSnapshot(IReadOnlyList<DcLease> liveSet)
    {
        var frontierByEnv = new Dictionary<Guid, long>();
        foreach (var lease in liveSet)
        {
            if (string.IsNullOrEmpty(lease.DcId) || lease.AppliedWatermarks is null)
            {
                continue;
            }

            foreach (var (envId, watermark) in lease.AppliedWatermarks)
            {
                if (!frontierByEnv.TryGetValue(envId, out var currentFrontier) || watermark > currentFrontier)
                {
                    frontierByEnv[envId] = watermark;
                }
            }
        }

        var snapshot = new List<AppliedWatermarkLagMeasurement>();
        foreach (var lease in liveSet)
        {
            if (string.IsNullOrEmpty(lease.DcId) || lease.AppliedWatermarks is null)
            {
                continue;
            }

            foreach (var (envId, watermark) in lease.AppliedWatermarks)
            {
                var lagMs = frontierByEnv[envId] - watermark;
                snapshot.Add(new AppliedWatermarkLagMeasurement(lease.DcId, envId, lagMs));
            }
        }

        AppliedWatermarkLagSnapshot.Update(snapshot);
    }

    /// <summary>
    /// F1 (#24): record a stage-to-commit latency sample. <paramref name="resourceUpdatedAt"/> is the
    /// staged value's <c>UpdatedAt</c> (the staged version's timestamp), so <c>now - UpdatedAt</c>
    /// approximates stage->commit latency. Clamped at 0 to avoid a negative sample from clock skew.
    /// </summary>
    private static void RecordTimeToCommit(string resourceType, DateTime resourceUpdatedAt)
    {
        var updatedAtUtc = DateTime.SpecifyKind(resourceUpdatedAt, DateTimeKind.Utc);
        var elapsedMs = (DateTime.UtcNow - updatedAtUtc).TotalMilliseconds;
        if (elapsedMs < 0)
        {
            elapsedMs = 0;
        }

        TimeToCommitHistogram.Record(
            elapsedMs,
            new KeyValuePair<string, object?>("resource_type", resourceType));
    }

    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ICacheService _compositeCache;
    private readonly IMessageProducer _messageProducer;
    private readonly ILeaderElection _leaderElection;
    private readonly bool _enabled;
    private readonly TimeSpan _interval;
    private readonly ILogger<CommitCoordinatorWorker> _logger;

    public CommitCoordinatorWorker(
        IServiceScopeFactory scopeFactory,
        [FromKeyedServices("compositeCache")] ICacheService compositeCache,
        IMessageProducer messageProducer,
        ILeaderElection leaderElection,
        IConfiguration configuration,
        ILogger<CommitCoordinatorWorker> logger)
    {
        _scopeFactory = scopeFactory;
        _compositeCache = compositeCache;
        _messageProducer = messageProducer;
        _leaderElection = leaderElection;
        _logger = logger;
        _enabled = configuration.GetConsistencyMode() == ConsistencyMode.GatedCommit;

        var seconds = configuration.GetValue<int?>("ControlPlane:CommitCoordinator:IntervalSeconds");
        _interval = seconds is > 0
            ? TimeSpan.FromSeconds(seconds.Value)
            : DefaultInterval;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (!_enabled)
        {
            _logger.LogInformation(
                "Commit coordinator disabled (consistency mode is not GatedCommit).");
            return;
        }

        using var timer = new PeriodicTimer(_interval);
        while (await timer.WaitForNextTickAsync(stoppingToken))
        {
            try
            {
                var committed = await RunOnceAsync(stoppingToken);
                if (committed > 0)
                {
                    _logger.LogInformation(
                        "Commit coordinator committed {CommittedCount} pending flag/segment change(s).",
                        committed);
                }
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                // ignore cancellation from the timer loop itself
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error occurred while running the commit coordinator tick.");
            }
        }
    }

    /// <summary>
    /// Performs a single coordinator tick and returns the number of flags AND segments committed —
    /// <c>0</c> if this instance is not the elected leader (see #71b gate below), or if nothing was
    /// pending, or if no pending change was eligible to commit this tick. Exposed so it can be
    /// invoked directly (e.g. by integration tests) without waiting on the periodic timer.
    ///
    /// For each pending flag whose pending version is newer than its committed version, if every
    /// currently live DC has that version staged, the flag is committed across all DCs, its pending
    /// is promoted (version-guarded), and the change is published to the evaluation-server topic.
    /// Pending segments are then reconciled the same way; committing a segment additionally replays
    /// the affected-flags propagation (see the type summary). Anything not yet staged everywhere is
    /// left pending and retried on the next tick.
    /// </summary>
    public async Task<int> RunOnceAsync(CancellationToken cancellationToken = default)
    {
        // #71b: only the elected leader runs the tick. Non-leaders skip entirely (Debug — this is
        // expected steady-state on every non-leader replica, not an error).
        //
        // #105: also RESET the gauge snapshots here. The ObservableGauge callbacks read these
        // snapshots on every export with no leader filter of their own, and they are refreshed only
        // AFTER this gate — so a replica that loses leadership would otherwise keep exporting its
        // stale last-leader snapshot indefinitely. Latent today (no exporter wired up), but activates
        // the moment metrics are exported from more than one replica.
        if (!_leaderElection.ShouldRunAsLeader(_logger, "Commit coordinator"))
        {
            PendingBacklogSnapshot.Reset();
            AppliedWatermarkLagSnapshot.Reset();
            return 0;
        }

        // IFeatureFlagService is a scoped (per-request) service in DI; resolve it inside a scope so
        // the singleton BackgroundService does not capture a scoped/disposed instance. The segment
        // services are resolved from the SAME scope, matching the flag path.
        using var scope = _scopeFactory.CreateScope();
        var featureFlagService = scope.ServiceProvider.GetRequiredService<IFeatureFlagService>();
        var leaseStore = scope.ServiceProvider.GetRequiredService<ILeaseStore>();

        var pending = await featureFlagService.GetPendingAsync();
        var pendingSegments = await scope.ServiceProvider
            .GetRequiredService<ISegmentService>()
            .GetPendingAsync();

        // F1 (#24): refresh the observable pending-backlog gauge from this tick's GetPendingAsync
        // counts. Done up front so EVERY return path (including the no-pending and no-live-DC early
        // returns below) reports the current backlog. Side-effect-only; does not affect commits.
        PendingBacklogSnapshot.Update(
        [
            new ResourceTypeCount("flag", pending.Count),
            new ResourceTypeCount("segment", pendingSegments.Count)
        ]);

        // Live DCs = distinct DcIds that currently hold at least one unexpired lease. Loaded
        // unconditionally (even when nothing is pending) because the #84 applied-watermark-lag
        // gauge is refreshed from this same live set every tick, independent of pending work.
        var liveSet = await leaseStore.GetLiveSetAsync(DateTimeOffset.UtcNow);
        var liveDcs = liveSet
            .Select(lease => lease.DcId)
            .Where(id => !string.IsNullOrEmpty(id))
            .Distinct()
            .ToList();

        // #84: refresh the observable applied-watermark-lag gauge snapshot from this tick's live
        // set. Side-effect-only; independent of pending flags/segments and of the commit decision
        // below.
        RefreshAppliedWatermarkLagSnapshot(liveSet);

        if (pending.Count == 0 && pendingSegments.Count == 0)
        {
            return 0;
        }

        if (liveDcs.Count == 0)
        {
            // No live DC to serve to -> nothing to commit this tick.
            return 0;
        }

        // GetStagedDcsAsync is a coordinator-only probe that lives on CompositeRedisCacheService,
        // not on the ICacheService contract. In the Redis path the keyed "compositeCache" service
        // is always a CompositeRedisCacheService; guard the cast so a misconfiguration (e.g. None
        // cache) degrades to a clear log instead of a crash loop.
        if (_compositeCache is not CompositeRedisCacheService composite)
        {
            _logger.LogWarning(
                "Commit coordinator requires the composite Redis cache (got {CacheType}); skipping tick.",
                _compositeCache.GetType().FullName);
            return 0;
        }

        var count = 0;

        foreach (var flag in pending)
        {
            cancellationToken.ThrowIfCancellationRequested();

            var pendingChange = flag.Pending;
            if (pendingChange == null)
            {
                continue;
            }

            var version = pendingChange.Version;

            // Monotonicity (#34): never commit a version that is not strictly newer than what is
            // already committed. Skips stale/duplicate pending rows.
            if (version <= flag.CommittedVersion)
            {
                continue;
            }

            var stagedMap = await composite.GetStagedDcsAsync(flag.Id, version);

            // Gate: EVERY live DC must have this exact version staged. A DC missing from the map,
            // or present-but-false, blocks the commit (we retry next tick once it catches up).
            var allLiveStaged = liveDcs.All(dc => stagedMap.TryGetValue(dc, out var staged) && staged);
            if (!allLiveStaged)
            {
                continue;
            }

            // Broadcast the commit to all DCs: advance the committed pointer + index everywhere.
            await composite.CommitFlagAsync(flag.EnvId, flag.Id.ToString(), version);

            // Version-guarded promote of the DB pending -> committed. If a racing SetPendingAsync
            // replaced the pending version since GetPendingAsync read it, the guard makes this a
            // no-op and we do NOT publish a stale value.
            var promoted = await featureFlagService.PromotePendingAsync(flag.EnvId, flag.Key, version);
            if (!promoted)
            {
                continue;
            }

            // Publish the newly committed value to the evaluation-server topic. The pending value
            // IS the new committed state; it carries the same shape the BestEffort path publishes.
            await _messageProducer.PublishAsync(Topics.FeatureFlagChange, pendingChange.Value);
            count++;

            // F1 (#24): consistency metrics. Side-effect-only — must not change commit behavior.
            // One commit increment (tagged resource_type=flag + env_id) and one stage->commit latency
            // sample (now - the staged value's UpdatedAt).
            CommitsCounter.Add(
                1,
                new KeyValuePair<string, object?>("resource_type", "flag"),
                new KeyValuePair<string, object?>("env_id", flag.EnvId.ToString()));
            RecordTimeToCommit("flag", pendingChange.Value.UpdatedAt);

            // Observability (#16): the commit decision above is intentionally made on the LIVE set
            // (committing without a down DC is the design). Record — for operators — any CONFIGURED
            // DC that was evicted (probed by GetStagedDcsAsync, so present in the staged map's key
            // set, but absent from the live set). This does not change the commit decision.
            var evictedDcs = stagedMap.Keys
                .Where(dc => !liveDcs.Contains(dc))
                .ToList();

            if (evictedDcs.Count > 0)
            {
                foreach (var dc in evictedDcs)
                {
                    EvictedCommitCounter.Add(1, new KeyValuePair<string, object?>("dc_id", dc));
                }

                _logger.LogWarning(
                    "Committed flag {FlagId} v{Version} without DC(s) {EvictedDcs} — proceeding on live set.",
                    flag.Id,
                    version,
                    string.Join(", ", evictedDcs));
            }
        }

        // ---- Segment loop (S3 / #17): mirrors the flag loop above. ----
        if (pendingSegments.Count > 0)
        {
            // Resolve the segment-side services from the SAME per-tick scope, exactly like the flag
            // services. These are the services SegmentChangeMessageHandler's BestEffort branch uses
            // for the affected-flags propagation we replicate at commit time.
            var segmentService = scope.ServiceProvider.GetRequiredService<ISegmentService>();
            var segmentMessageService = scope.ServiceProvider.GetRequiredService<ISegmentMessageService>();
            var featureFlagAppService = scope.ServiceProvider.GetRequiredService<IFeatureFlagAppService>();

            foreach (var segment in pendingSegments)
            {
                cancellationToken.ThrowIfCancellationRequested();

                var pendingChange = segment.Pending;
                if (pendingChange == null)
                {
                    continue;
                }

                // V is the staged Redis version, which S2 sets to UpdatedAt-as-unix-ms when staging
                // (PendingSegmentChange.Version == ToUnixTimeMilliseconds(UpdatedAt)).
                var version = pendingChange.Version;

                // Monotonicity (#34): never commit a version that is not strictly newer than what is
                // already committed. Skips stale/duplicate pending rows.
                if (version <= segment.CommittedVersion)
                {
                    continue;
                }

                var stagedMap = await composite.GetStagedSegmentDcsAsync(segment.Id, version);

                // Gate: EVERY live DC must have this exact version staged. A DC missing from the map,
                // or present-but-false, blocks the commit (we retry next tick once it catches up).
                var allLiveStaged = liveDcs.All(dc => stagedMap.TryGetValue(dc, out var staged) && staged);
                if (!allLiveStaged)
                {
                    continue;
                }

                // The env set is needed both to advance the committed pointer/index in Redis and to
                // drive the per-env affected-flags propagation below.
                var envIds = await segmentService.GetEnvironmentIdsAsync(segment);

                // Broadcast the commit to all DCs: advance the committed pointer + index everywhere.
                await composite.CommitSegmentAsync(envIds, segment.Id.ToString(), version);

                // Version-guarded promote of the DB pending -> committed. If a racing SetPendingAsync
                // replaced the pending version since GetPendingAsync read it, the guard makes this a
                // no-op and we do NOT publish a stale value.
                var promoted = await segmentService.PromotePendingAsync(segment.Id, version);
                if (!promoted)
                {
                    continue;
                }

                // Replicate SegmentChangeMessageHandler's BestEffort affected-flags propagation,
                // deferred to commit time. Reconstruct the notification from the (now committed)
                // segment using the attribution persisted on the pending change at stage time
                // (#73) instead of hardcoding it, so GetAffectedFlagsAsync recomputes the affected
                // flags with the real Operation/IsTargetingChange, and OnSegmentUpdatedAsync (below)
                // stamps the real operator. Legacy pending rows staged before #73 deserialize with
                // OperatorId = Guid.Empty / Operation = Update / IsTargetingChange = true, which is
                // exactly the coordinator's prior hardcoded behavior.
                var committedSegment = await segmentService.GetCommittedAsync(segment.Id);
                var notification = new OnSegmentChange(
                    committedSegment,
                    pendingChange.Operation,
                    // DataChange is intentionally empty: the only consumer on this path
                    // (OnSegmentUpdatedAsync) recomputes its own before/after locally, and the
                    // audit log / webhook publishes for the segment itself already happened at
                    // stage time with the real notification.
                    new DataChange(),
                    operatorId: pendingChange.OperatorId,
                    isTargetingChange: pendingChange.IsTargetingChange);

                foreach (var envId in envIds)
                {
                    var affectedFlags =
                        await segmentMessageService.GetAffectedFlagsAsync(envId, notification);

                    // update affected flags
                    if (affectedFlags.Count > 0)
                    {
                        await featureFlagAppService.OnSegmentUpdatedAsync(
                            committedSegment,
                            notification.OperatorId,
                            affectedFlags);
                    }

                    // publish segment change message
                    await segmentMessageService.PublishSegmentChangeMessage(envId, affectedFlags, committedSegment);
                }

                count++;

                // F1 (#24): consistency metrics, mirroring the flag path. Side-effect-only. One commit
                // increment (tagged resource_type=segment) and one stage->commit latency sample (now -
                // the staged value's UpdatedAt, whose unix-ms equals the staged version).
                CommitsCounter.Add(
                    1,
                    new KeyValuePair<string, object?>("resource_type", "segment"));
                RecordTimeToCommit("segment", pendingChange.Value.UpdatedAt);

                // Observability (#16): mirror the flag path — record any CONFIGURED DC that was
                // evicted (present in the probed staged map's keys but absent from the live set).
                // This does not change the commit decision (made on the live set by design).
                var evictedDcs = stagedMap.Keys
                    .Where(dc => !liveDcs.Contains(dc))
                    .ToList();

                if (evictedDcs.Count > 0)
                {
                    foreach (var dc in evictedDcs)
                    {
                        EvictedCommitCounter.Add(1, new KeyValuePair<string, object?>("dc_id", dc));
                    }

                    _logger.LogWarning(
                        "Committed segment {SegmentId} v{Version} without DC(s) {EvictedDcs} — proceeding on live set.",
                        segment.Id,
                        version,
                        string.Join(", ", evictedDcs));
                }
            }
        }

        return count;
    }
}
