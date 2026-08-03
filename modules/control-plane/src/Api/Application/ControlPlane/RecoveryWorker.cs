using Api.Infrastructure.Caches;
using Application;
using Application.ControlPlane;
using Domain.Messages;

namespace Api.Application.ControlPlane;

/// <summary>
/// E1 returning-DC recovery (catch-up-before-serve). Under <see cref="ConsistencyMode.GatedCommit"/>
/// the commit coordinator commits a flag (and, identically, a segment) on the LIVE set, so a
/// flag/segment that changed while a DC was evicted is committed with NO pending — the returned DC's
/// Redis would otherwise stay stale forever. This worker watches the live set; when a DC newly
/// appears (its lease returns), it backfills that DC's Redis with the COMMITTED value of every flag
/// AND every segment (stage the versioned value + flip the committed pointer + advance the index),
/// AND every secret (#91: unconditional upsert — secrets carry no staged/committed lifecycle to gate
/// on), so the returned DC catches up — including SDK auth, which a flag/segment-only backfill would
/// leave broken.
///
/// Model A, locked decisions:
///  - A: a separate worker (this one), not folded into the commit coordinator.
///  - B: per-DC TARGETED writes (<see cref="CompositeRedisCacheService.StageFlagToDcAsync"/> /
///       <see cref="CompositeRedisCacheService.CommitFlagToDcAsync"/>) — only the returned DC is
///       written, never a broadcast.
///  - C: no readiness gate — backfill runs as soon as the DC is seen live.
///  - D: per-DC client refresh — after a returned DC's backfill, a <c>PushFullSync</c> command is
///       published with <see cref="ControlPlaneCommand.TargetDcId"/> set to that DcId, so only that
///       DC's eval servers refresh their connected SDK clients (others ignore the targeted command).
///       Best-effort: a publish failure is logged but does NOT fail the backfill.
///
/// Idempotent: re-staging/re-committing an already-present version is a no-op (the staged value key
/// and committed pointer are version-keyed), AND, since #89, the committed-pointer flip itself is
/// only-advance-guarded — a stale/duplicate backfill run can never revert a fresher pointer a
/// concurrent commit or another backfill already wrote, even outside the exact-version-match case.
/// It does NOT publish <c>Topics.FeatureFlagChange</c> — the committed value did not change
/// globally, only one DC's Redis is being repaired.
///
/// #71b: this worker only runs its tick on the elected leader (<see cref="ILeaderElection"/>,
/// backed by <see cref="RedisLeaderElector"/>) when leader election is enabled; non-leaders skip the
/// tick entirely. When disabled (default — <c>ControlPlane:LeaderElection:Enabled</c>) every
/// instance runs — safe (idempotent/version guards, see above) but redundant under multiple
/// replicas. Idempotency guards (see above) still make concurrent execution safe belt-and-braces
/// during a failover overlap window, so losing leadership mid-tick is harmless.
///
/// #90: when more than one DC returns in the same tick, <see cref="RunOnceAsync"/> fetches the
/// committed snapshot ONCE (<see cref="IDcBackfiller.FetchCommittedSnapshotAsync"/>) and shares it
/// across every returned DC's backfill, so they are all repaired from an identical view of the source
/// of truth (restores the pre-#74-refactor guarantee) instead of each DC re-reading the source of
/// truth independently.
///
/// ASSUMPTION (per-DC client refresh): the targeted <c>PushFullSync</c> command relies on the
/// <see cref="ControlPlaneTopics.ControlPlaneCommand"/> topic reaching EVERY DC's eval servers (the
/// existing admin "push full sync to ALL active clients" implies it does). The TargetDcId filter then
/// scopes who acts. If, in some MQ topologies, control-plane commands are delivered only locally,
/// remote-DC targeting would additionally need a per-DC command publish — a follow-up, NOT built here.
/// </summary>
public sealed class RecoveryWorker : BackgroundService
{
    /// <summary>
    /// Default interval between recovery ticks when not overridden via
    /// <c>ControlPlane:Recovery:IntervalSeconds</c>.
    /// </summary>
    public static readonly TimeSpan DefaultInterval = TimeSpan.FromSeconds(10);

    private readonly IServiceScopeFactory _scopeFactory;
    private readonly IDcBackfiller _backfiller;
    private readonly ILeaderElection _leaderElection;
    private readonly bool _enabled;
    private readonly TimeSpan _interval;
    private readonly ILogger<RecoveryWorker> _logger;

    // DcIds seen live on the previous tick. A DcId present now but absent here is "newly present"
    // (returned / first-seen) and gets backfilled. First-seen counts as returned, which is harmless
    // (the DC is current after the backfill regardless).
    private HashSet<string> _previousLiveSet = new();

    public RecoveryWorker(
        IServiceScopeFactory scopeFactory,
        IDcBackfiller backfiller,
        ILeaderElection leaderElection,
        IConfiguration configuration,
        ILogger<RecoveryWorker> logger)
    {
        _scopeFactory = scopeFactory;
        _backfiller = backfiller;
        _leaderElection = leaderElection;
        _logger = logger;
        _enabled = configuration.GetConsistencyMode() == ConsistencyMode.GatedCommit;

        var seconds = configuration.GetValue<int?>("ControlPlane:Recovery:IntervalSeconds");
        _interval = seconds is > 0
            ? TimeSpan.FromSeconds(seconds.Value)
            : DefaultInterval;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (!_enabled)
        {
            _logger.LogInformation(
                "Recovery worker disabled (consistency mode is not GatedCommit).");
            return;
        }

        using var timer = new PeriodicTimer(_interval);
        while (await timer.WaitForNextTickAsync(stoppingToken))
        {
            try
            {
                var backfilled = await RunOnceAsync(stoppingToken);
                if (backfilled > 0)
                {
                    _logger.LogInformation(
                        "Recovery worker backfilled {BackfilledCount} returning DC(s).",
                        backfilled);
                }
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                // ignore cancellation from the timer loop itself
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error occurred while running the recovery worker tick.");
            }
        }
    }

    /// <summary>
    /// Performs a single recovery tick and returns the number of DCs backfilled — <c>0</c> if this
    /// instance is not the elected leader (see #71b gate below), or if no DC newly returned. Exposed
    /// so it can be invoked directly (e.g. by integration tests) without waiting on the periodic timer.
    ///
    /// For each DcId newly present in the live set since the previous tick, every flag's AND every
    /// segment's committed value is staged and committed into that DC's Redis (targeted, not
    /// broadcast), AND every secret cache entry is upserted (#91, unconditional — not staged/gated).
    /// </summary>
    public async Task<int> RunOnceAsync(CancellationToken cancellationToken = default)
    {
        // #71b: only the elected leader runs the tick. Non-leaders skip entirely (Debug — this is
        // expected steady-state on every non-leader replica, not an error). The previous-live-set
        // watermark is intentionally left untouched: if/when this instance becomes leader, the first
        // tick treats every currently-live DC as "returned" (first-seen), which is the same harmless
        // behavior a freshly-started worker already exhibits.
        if (!_leaderElection.ShouldRunAsLeader(_logger, "Recovery worker"))
        {
            return 0;
        }

        // ILeaseStore is scoped (per-request) in DI; resolve it inside a scope so the singleton
        // BackgroundService does not capture a scoped/disposed instance.
        using var scope = _scopeFactory.CreateScope();
        var leaseStore = scope.ServiceProvider.GetRequiredService<ILeaseStore>();

        // Live DCs = distinct DcIds that currently hold at least one unexpired lease.
        var liveSet = await leaseStore.GetLiveSetAsync(DateTimeOffset.UtcNow);
        var liveDcs = liveSet
            .Select(lease => lease.DcId)
            .Where(id => !string.IsNullOrEmpty(id))
            .Distinct()
            .ToHashSet();

        // Newly-present DcIds = live now but not on the previous tick.
        var returned = liveDcs.Where(dc => !_previousLiveSet.Contains(dc)).ToList();

        // Advance the watermark for the next tick regardless of what we do below.
        _previousLiveSet = liveDcs;

        if (returned.Count == 0)
        {
            return 0;
        }

        // #92: check the composite-cache guard ONCE per tick, before the per-DC loop, so a
        // misconfiguration (e.g. a None cache) logs a single warning per tick instead of once per
        // returned DC — and skips the committed-snapshot fetch entirely instead of reading the DB only
        // to discard it. The previous-live-set watermark was already advanced above (each returned
        // DcId is now considered "seen"), so without corrective action a real reconnect immediately
        // after a transient misconfiguration fix would never be re-detected as "returned". Mirror
        // CacheReconciler's equivalent guard and explicitly un-advance the watermark for these DCs so
        // the NEXT tick treats them as newly-returned again once the guard clears.
        if (!_backfiller.IsCompositeCacheAvailable)
        {
            _logger.LogWarning(
                "Recovery worker: composite Redis cache is unavailable; skipping backfill for " +
                "{Count} returned DC(s) this tick ({DcIds}). Will retry once they are re-detected " +
                "as returned.",
                returned.Count,
                string.Join(", ", returned));
            // Force a retry: forget these DCs from the watermark so next tick treats them as
            // newly-returned again once the guard clears.
            foreach (var dcId in returned)
            {
                _previousLiveSet.Remove(dcId);
            }
            return 0;
        }

        // #90 (extended by #91 to also cover secrets): fetch the committed snapshot (flags + segments
        // + segment env-ids + secret caches) ONCE per tick and share it across every DC returned this
        // tick, instead of letting each DC's backfill re-fetch
        // it. This restores the pre-#74-refactor guarantee that two DCs returning in the same tick are
        // backfilled from an IDENTICAL view of the source of truth, and halves-to-Nths the DB reads
        // for a multi-DC tick.
        var snapshot = await _backfiller.FetchCommittedSnapshotAsync(cancellationToken);

        // #92/#105: honest metrics — count a DC as "backfilled" only when the shared backfiller
        // actually did work for it AND that work was ACCEPTED, not merely because it was in the
        // "returned" set this tick. A DC's call returns IDcBackfiller.Skipped (not a repair) when it
        // coalesced with a concurrent backfill of the same DC (e.g. CacheReconciler backfilling it at
        // the same moment) — that DC IS being repaired, just not by this call, so it must not be
        // double-counted. #105: BackfillDcAsync's return is now the ACCEPTED flag count (not the
        // attempted count — see IDcBackfiller's #105 doc), so a run that genuinely accepted zero
        // writes (the DC's Redis already matched the source of truth for every flag) must ALSO not
        // be counted as a repair, even though it was not skipped/coalesced.
        var backfilled = 0;
        foreach (var dcId in returned)
        {
            cancellationToken.ThrowIfCancellationRequested();

            // GatedCommit backfill of the returned DC from the shared snapshot (staged versioned
            // value + committed pointer + index) followed by a targeted PushFullSync — delegated to
            // the shared backfiller, which CacheReconciler also uses (with the mode-appropriate
            // write path).
            var result = await _backfiller.BackfillDcAsync(dcId, ConsistencyMode.GatedCommit, snapshot, cancellationToken);
            if (result == IDcBackfiller.Skipped)
            {
                _logger.LogDebug(
                    "Recovery worker: backfill for returned DC {DcId} was skipped this tick " +
                    "(coalesced with a concurrent backfill already in flight for that DC).",
                    dcId);
            }
            else if (result > 0)
            {
                backfilled++;
            }
            else
            {
                _logger.LogDebug(
                    "Recovery worker: backfill for returned DC {DcId} ran but the only-advance guard " +
                    "accepted zero flag writes (its Redis already matched the source of truth); not " +
                    "counted as a repair.",
                    dcId);
            }
        }

        return backfilled;
    }
}
