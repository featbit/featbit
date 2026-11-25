using Application.Caches;
using Application.ControlPlane;
using Application.Services;
using Api.Infrastructure.Caches;
using Domain.Environments;
using Domain.FeatureFlags;
using Domain.Messages;
using Domain.Segments;
using Action = Domain.Messages.Action;

namespace Api.Application.ControlPlane;

/// <summary>
/// A point-in-time snapshot of the source of truth (Mongo/Postgres) committed flags + segments +
/// secrets, plus each committed segment's resolved target env ids — fetched once via
/// <see cref="IDcBackfiller.FetchCommittedSnapshotAsync"/> and shared across every DC backfilled in
/// the same tick (<see cref="RecoveryWorker"/>, <see cref="CacheReconciler"/>) so two DCs recovering
/// in one tick are written from an IDENTICAL view of the source of truth, and so the DB is read once
/// per tick rather than once per DC (#90). Env ids are resolved once here (independent of the DC being
/// repaired) because they are themselves a DB lookup (<c>ISegmentService.GetEnvironmentIdsAsync</c>).
/// <see cref="Secrets"/> (#91) is enumerated the same way the api-server's
/// <c>RedisPopulatingService.PopulateSecretsAsync</c> does (<c>IEnvironmentService.GetSecretCachesAsync</c>)
/// so a DC backfill's secret coverage matches startup population.
/// <see cref="EnvironmentIds"/> lists every environment, including one with no flags, segments or secrets left, so
/// that the prune step checks its indexes too. It is not read while pruning is off; when the read fails,
/// <see cref="EnvironmentListUnreadable"/> is set and the prune looks again later.
/// </summary>
public sealed record CommittedSnapshot(
    IReadOnlyList<FeatureFlag> Flags,
    IReadOnlyList<Segment> Segments,
    IReadOnlyDictionary<string, ICollection<Guid>> SegmentEnvIds,
    IReadOnlyList<SecretCache> Secrets,
    DateTimeOffset? TakenAt = null,
    IReadOnlyCollection<Guid>? EnvironmentIds = null,
    bool EnvironmentListUnreadable = false);

/// <summary>
/// Backfills ONE DC's Redis with the authoritative (committed) value of every flag, segment, and
/// secret, read from the source of truth (Mongo/Postgres) — then publishes a per-DC
/// <c>PushFullSync</c> so that DC's eval servers refresh their connected SDK clients.
///
/// Shared by two triggers:
///  - <see cref="RecoveryWorker"/> (GatedCommit, lease-return trigger), and
///  - <see cref="CacheReconciler"/> (mode-agnostic, Redis-link-reachable trigger, local + peers).
///
/// The flag/segment write path is mode-appropriate: GatedCommit stages the versioned value + flips
/// the committed pointer (so the eval reads the versioned snapshot); BestEffort upserts the legacy
/// <c>featbit:flag:{id}</c> key the BestEffort eval reads. Secrets (#91) are NOT staged/gated in
/// either mode — the source-of-truth secret cache shape (<c>featbit:secret:{value}</c>, a hash keyed
/// by the secret's own value) has no version to gate on, so they are written unconditionally in BOTH
/// modes, exactly like the api-server's initial population. All writes are targeted at the one DC
/// (never broadcast) and idempotent, so re-running is safe.
///
/// Each backfill run is driven by a <see cref="CommittedSnapshot"/> of the source of truth taken up
/// front (<see cref="FetchCommittedSnapshotAsync"/>), then awaits per-item writes, so a version
/// committed AFTER the snapshot was taken can land on the target DC before this backfill's write for
/// the same flag/segment does. Without a guard that race would let a stale snapshot revert a fresher
/// pointer (#89) — every targeted flag/segment write this method makes
/// (<see cref="CompositeRedisCacheService.CommitFlagToDcAsync"/>,
/// <see cref="CompositeRedisCacheService.CommitSegmentToDcAsync"/>,
/// <see cref="CompositeRedisCacheService.UpsertFlagToDcAsync"/>,
/// <see cref="CompositeRedisCacheService.UpsertSegmentToDcAsync"/>) is only-advance guarded at the
/// Redis layer, so a stale write from this snapshot is a no-op instead of a regression. The secret
/// write (<see cref="CompositeRedisCacheService.UpsertSecretToDcAsync"/>) is NOT guarded the same
/// way — there is no version to compare, so it is last-write-wins, matching the existing (broadcast)
/// <c>UpsertSecretAsync</c> semantic.
///
/// #90: a caller backfilling more than one DC in the same tick (RecoveryWorker/CacheReconciler) should
/// call <see cref="FetchCommittedSnapshotAsync"/> ONCE and pass the resulting snapshot to the
/// <see cref="BackfillDcAsync(string,ConsistencyMode,CommittedSnapshot,CancellationToken)"/> overload
/// for each DC, instead of using the no-snapshot overload per DC (which re-fetches every call). This
/// invariant (one fetch per tick) applies to secrets too (#91): they are part of the same
/// <see cref="CommittedSnapshot"/>.
///
/// #92: the per-DC in-flight set lives HERE (a singleton shared by both <see cref="RecoveryWorker"/>
/// and <see cref="CacheReconciler"/>), not on either caller, so a <see cref="RecoveryWorker"/> tick and
/// a <see cref="CacheReconciler"/> tick backfilling the SAME DcId at the same time coalesce against
/// each other rather than each running a redundant full read/write cycle — the second concurrent call
/// for a given DcId returns immediately with <see cref="Skipped"/> instead of doing any work.
///
/// #105: the #92 comments above describe a "genuinely failed guard must not be reported as a repair"
/// invariant that, before #105, the code did not actually enforce — <see cref="BackfillDcAsync(string,ConsistencyMode,CancellationToken)"/>
/// returned the ATTEMPTED flag count (<c>snapshot.Flags.Count</c>) regardless of whether the
/// only-advance guard (#89) accepted or rejected each write. The guard scripts always returned an
/// accept signal (1/0); it was simply discarded at every layer. Fixed by plumbing that signal through
/// <see cref="CompositeRedisCacheService"/>'s targeted write methods (now <c>Task&lt;bool&gt;</c>) up
/// to <c>DcBackfiller.RunBackfillAsync</c>, which now returns the ACCEPTED flag count. See
/// <see cref="RecoveryWorker.RunOnceAsync"/> for the corresponding "count as repaired only when
/// accepted > 0" fix, and <see cref="CacheReconciler.RunReconcileAsync"/> for why its min-backfill
/// cooldown does NOT need the same accepted-count gate (per-key guard independence).
/// </summary>
public interface IDcBackfiller
{
    /// <summary>
    /// Sentinel <see cref="BackfillDcAsync(string,ConsistencyMode,CancellationToken)"/> /
    /// <see cref="BackfillDcAsync(string,ConsistencyMode,CommittedSnapshot,CancellationToken)"/> return
    /// value meaning the call did NO work — either the composite Redis cache is unavailable (see
    /// <see cref="IsCompositeCacheAvailable"/>) or a backfill for that DcId was already in flight
    /// (#92 coalescing). Distinct from a legitimate <c>0</c> (#105), which means the backfill ran but
    /// genuinely had nothing to repair — every flag/segment write was rejected by the only-advance
    /// guard (#89) because the DC's Redis already held an equal/fresher value, AND no secrets were in
    /// the snapshot.
    /// </summary>
    public const int Skipped = -1;

    /// <summary>
    /// Cheap, non-logging check of whether the composite Redis cache is configured (i.e. backfills can
    /// actually do anything). Callers that process several DCs per tick (<see cref="RecoveryWorker"/>,
    /// <see cref="CacheReconciler"/>) should check this ONCE per tick before looping so a
    /// misconfiguration logs a single warning per tick instead of once per DC (#92) — see
    /// <see cref="RecoveryWorker.RunOnceAsync"/>.
    /// </summary>
    bool IsCompositeCacheAvailable { get; }

    /// <summary>
    /// Backfill <paramref name="dcId"/>'s Redis from the source of truth using the write path for
    /// <paramref name="mode"/>, then publish a targeted client refresh. Returns the TOTAL count of
    /// genuine writes this run made (#105) — accepted flags + accepted segments (both filtered by the
    /// only-advance guard, #89: a write rejected because the DC's Redis already held an equal/fresher
    /// value is NOT counted) PLUS every secret written (secrets carry no version to guard on, so an
    /// attempted secret write always counts) — or <see cref="Skipped"/> if the composite cache is
    /// unavailable or this DcId's backfill coalesced with one already in flight (#92). A return of
    /// exactly <c>0</c> (not <see cref="Skipped"/>) means the run genuinely found nothing to repair.
    /// Convenience overload for single-DC callers: fetches its own <see cref="CommittedSnapshot"/>
    /// internally. A caller backfilling multiple DCs in one tick should instead call
    /// <see cref="FetchCommittedSnapshotAsync"/> once and use the snapshot-accepting overload so every
    /// DC in that tick shares one fetch.
    /// </summary>
    Task<int> BackfillDcAsync(string dcId, ConsistencyMode mode, CancellationToken cancellationToken = default);

    /// <summary>
    /// Backfill <paramref name="dcId"/>'s Redis from the pre-fetched <paramref name="snapshot"/> using
    /// the write path for <paramref name="mode"/>, then publish a targeted client refresh. Returns the
    /// TOTAL count of genuine writes this run made (#105 — see the single-DC overload's doc for what
    /// "genuine" means), or <see cref="Skipped"/> if the composite cache is unavailable or this
    /// DcId's backfill coalesced with one already in flight (#92).
    /// </summary>
    Task<int> BackfillDcAsync(
        string dcId,
        ConsistencyMode mode,
        CommittedSnapshot snapshot,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Fetch a fresh <see cref="CommittedSnapshot"/> of the source of truth: every committed flag,
    /// every committed segment, each committed segment's resolved target env ids, and every secret
    /// cache entry (#91). Call this ONCE per tick when backfilling multiple DCs so they share an
    /// identical view (#90).
    /// </summary>
    Task<CommittedSnapshot> FetchCommittedSnapshotAsync(CancellationToken cancellationToken = default);

    /// <summary>
    /// The DCs whose last prune left entries for later (for example because they were too recent to remove, or
    /// an index could not be read) and for which that time has now come. A cheap, in-memory check. A DC that is
    /// returned is not returned again for a minute, so a caller that cannot prune it right away does not retry
    /// on every tick; pruning it resets the schedule.
    /// </summary>
    IEnumerable<string> TakeDcsDueForPrune();

    /// <summary>
    /// Runs only the prune step of a backfill for <paramref name="dcId"/>, from the pre-fetched
    /// <paramref name="snapshot"/>: removes the flags and segments that DC still lists although the source of
    /// truth no longer has them, and publishes a targeted client refresh if it removed any. Returns the number
    /// removed, or <see cref="Skipped"/> if the composite cache is unavailable or a backfill or prune of this
    /// DcId is already in flight. A prune yields to a backfill of the same DC; a backfill is never skipped
    /// because of a prune, since a prune does not repair what a backfill is there to write. It waits for the prune
    /// to finish instead, so the two never change the DC's Redis at the same time.
    /// </summary>
    Task<int> PruneDcAsync(
        string dcId,
        ConsistencyMode mode,
        CommittedSnapshot snapshot,
        CancellationToken cancellationToken = default);
}

public sealed class DcBackfiller(
    IServiceScopeFactory scopeFactory,
    [FromKeyedServices("compositeCache")] ICacheService compositeCache,
    IMessageProducer messageProducer,
    IConfiguration configuration,
    ILogger<DcBackfiller> logger,
    TimeProvider? timeProvider = null,
    IDcMutationLock? dcMutationLock = null) : IDcBackfiller
{
    private const string PruneSection = "ControlPlane:CacheReconcile:PruneDeleted";
    private const int DefaultMaxRemovalsPerRun = 200;
    private const int DefaultMinAgeSeconds = 600;
    private const int UnreadableIndexRetrySeconds = 60;

    private readonly TimeProvider _time = timeProvider ?? TimeProvider.System;

    // When a DC's prune is due again: it left entries for later, either too recent to remove yet or in an
    // index it could not read. Nothing else would come back for them, because a backfill only runs when a DC
    // becomes reachable. Guarded by _pruneScheduleLock, with _newestPruneSnapshot.
    private readonly object _pruneScheduleLock = new();
    private readonly Dictionary<string, DateTimeOffset> _pruneDueAt = new();

    // The time of the newest snapshot a prune of each DC has worked from. Only a prune from a snapshot at least that
    // new may clear or push back the schedule; one from an older snapshot (a backfill that read the database before
    // a later prune-only pass did) may only bring it forward, because what it saw as live may since have been deleted.
    private readonly Dictionary<string, DateTimeOffset> _newestPruneSnapshot = new();

    // Removals from a DC that failed, possibly part way: the index entry can be gone while the value is not, and the
    // index is how a prune finds entries. Kept so that the next prune of that DC finishes them. The flag map holds the
    // flag's environment, the segment map its environments.
    private readonly System.Collections.Concurrent.ConcurrentDictionary<(string DcId, Guid Id), Guid> _pendingFlagRemovals = new();
    private readonly System.Collections.Concurrent.ConcurrentDictionary<(string DcId, Guid Id), ICollection<Guid>> _pendingSegmentRemovals = new();

    // One per DC: held by a backfill for its whole run and by a prune-only pass, so the two never change a DC's Redis at
    // the same time. Without it, a backfill that checked an entry was not pruned could write it after a prune removed it
    // (and with it the index score that makes the only-advance guard reject an older write), recreating a deleted entry.
    private readonly System.Collections.Concurrent.ConcurrentDictionary<string, SemaphoreSlim> _dcGates = new();

    // What a prune removed from each DC, and when. Removing an entry also removes the index score that makes the
    // only-advance guard reject an older write, so a backfill whose snapshot was taken before the removal would
    // write the entry back (a deleted flag, with the content it had before it was archived). A backfill therefore
    // skips what was pruned after its snapshot was taken. Ids are never reused, so the marker is never wrong
    // about a different object; a later snapshot that holds the entry again writes it, as it should.
    private readonly System.Collections.Concurrent.ConcurrentDictionary<(string DcId, Guid Id), DateTimeOffset> _prunedAt = new();
    private static readonly TimeSpan PrunedMarkerRetention = TimeSpan.FromHours(1);

    // #92: DcIds with a backfill currently running, shared across EVERY caller (RecoveryWorker and
    // CacheReconciler both hold a reference to this same singleton), so the two workers coalesce
    // against each other instead of each maintaining their own (previously CacheReconciler-only)
    // in-flight set.
    private readonly object _inFlightLock = new();
    private readonly HashSet<string> _inFlight = new();

    // DcIds with a prune-only pass currently running. Kept apart from _inFlight so that a prune can never make a
    // backfill look like a duplicate and get it skipped.
    private readonly HashSet<string> _pruneInFlight = new();

    public bool IsCompositeCacheAvailable => compositeCache is CompositeRedisCacheService;

    /// <summary>
    /// Returns the DCs whose prune is due and pushes each one's next due time back a minute, so that a DC that cannot be
    /// pruned right away is not picked up again on every tick. Pruning a DC resets its schedule.
    /// </summary>
    public IEnumerable<string> TakeDcsDueForPrune()
    {
        var now = _time.GetUtcNow();
        lock (_pruneScheduleLock)
        {
            var due = _pruneDueAt.Where(e => e.Value <= now).Select(e => e.Key).ToList();
            foreach (var dcId in due)
            {
                _pruneDueAt[dcId] = now.AddSeconds(UnreadableIndexRetrySeconds);
            }

            return due;
        }
    }

    /// <summary>
    /// Runs only the prune step for one DC, from a snapshot the caller already fetched, and publishes a client refresh if it
    /// removed anything. It yields to a backfill of the same DC and to another prune; a backfill is never skipped because
    /// of a prune. Returns the number of entries removed, or <see cref="IDcBackfiller.Skipped"/>.
    /// </summary>
    public async Task<int> PruneDcAsync(
        string dcId,
        ConsistencyMode mode,
        CommittedSnapshot snapshot,
        CancellationToken cancellationToken = default)
    {
        if (!TryGetComposite(dcId, out var composite))
        {
            return IDcBackfiller.Skipped;
        }

        // A prune yields to a backfill of the same DC, which prunes as part of its run, and to another prune.
        // The other way round, a backfill is never skipped because a prune is running: a skipped backfill is
        // taken to mean that another backfill is repairing the DC, and a prune does not repair what a backfill
        // is there to write (a missed flag, segment or secret).
        lock (_inFlightLock)
        {
            if (_inFlight.Contains(dcId) || !_pruneInFlight.Add(dcId))
            {
                logger.LogDebug("DC prune: a backfill or prune for DC {DcId} is already in flight; skipping.", dcId);
                return IDcBackfiller.Skipped;
            }
        }

        var gate = GateFor(dcId);
        try
        {
            // A backfill that started after the check above holds the gate; the prune yields to it as well.
            if (!await gate.WaitAsync(0, cancellationToken))
            {
                logger.LogDebug("DC prune: a backfill for DC {DcId} is already in flight; skipping.", dcId);
                return IDcBackfiller.Skipped;
            }

            try
            {
                // The same, across replicas: a backfill or prune of this DC on another replica holds the DC's lock.
                IDcLease? lease = null;
                if (dcMutationLock is not null)
                {
                    lease = await dcMutationLock.TryAcquireAsync(dcId, cancellationToken);
                    if (lease is null)
                    {
                        logger.LogDebug(
                            "DC prune: DC {DcId} is locked by a backfill or prune elsewhere; skipping.", dcId);
                        return IDcBackfiller.Skipped;
                    }
                }

                await using (lease)
                {
                    var removed = await PruneSafelyAsync(dcId, mode, snapshot, composite, lease, cancellationToken);
                    if (removed > 0)
                    {
                        // The DC's clients may hold what was removed, as the backfill's own refresh would have told them.
                        await PublishClientRefreshAsync(dcId);
                    }

                    return removed;
                }
            }
            finally
            {
                gate.Release();
            }
        }
        finally
        {
            lock (_inFlightLock)
            {
                _pruneInFlight.Remove(dcId);
            }
        }
    }

    private SemaphoreSlim GateFor(string dcId) => _dcGates.GetOrAdd(dcId, _ => new SemaphoreSlim(1, 1));

    public async Task<int> BackfillDcAsync(
        string dcId,
        ConsistencyMode mode,
        CancellationToken cancellationToken = default)
    {
        // Convenience single-DC path: not shared with any other DC's backfill, so a fetch-per-call is
        // fine here. Guard the composite cache BEFORE fetching so a misconfiguration (e.g. None cache)
        // skips the DB round-trip entirely, same as before #90.
        if (!TryGetComposite(dcId, out _))
        {
            return IDcBackfiller.Skipped;
        }

        var snapshot = await FetchCommittedSnapshotAsync(cancellationToken);
        return await BackfillDcAsync(dcId, mode, snapshot, cancellationToken);
    }

    public async Task<int> BackfillDcAsync(
        string dcId,
        ConsistencyMode mode,
        CommittedSnapshot snapshot,
        CancellationToken cancellationToken = default)
    {
        // StageFlagToDcAsync / UpsertFlagToDcAsync etc. are targeted writes that live on
        // CompositeRedisCacheService, not on the ICacheService contract. In the Redis path the keyed
        // "compositeCache" service is always a CompositeRedisCacheService; guard the cast so a
        // misconfiguration (e.g. None cache) degrades to a clear log instead of a crash loop.
        if (!TryGetComposite(dcId, out var composite))
        {
            return IDcBackfiller.Skipped;
        }

        // #92: coalesce concurrent backfills of the SAME DcId — whether both come from this process's
        // RecoveryWorker and CacheReconciler racing each other, or two overlapping ticks of the same
        // caller. The loser returns immediately without touching Redis; the winner's in-progress (or
        // just-completed) backfill already covers it, and every underlying write is idempotent/
        // only-advance-guarded (#89) so there is nothing for the loser to "miss".
        lock (_inFlightLock)
        {
            if (!_inFlight.Add(dcId))
            {
                logger.LogDebug(
                    "DC backfill: a backfill for DC {DcId} is already in flight; coalescing (no-op).",
                    dcId);
                return IDcBackfiller.Skipped;
            }
        }

        try
        {
            // A prune-only pass of this DC may be running. The backfill waits for it rather than being skipped (a prune
            // does not write what a backfill repairs), and then sees what it removed, so it does not write that back.
            var gate = GateFor(dcId);
            await gate.WaitAsync(cancellationToken);
            try
            {
                // The same, across replicas: wait for a backfill or prune of this DC on another replica to finish.
                await using var lease = dcMutationLock is null
                    ? null
                    : await dcMutationLock.AcquireAsync(dcId, cancellationToken);
                return await RunBackfillAsync(dcId, mode, snapshot, composite, lease, cancellationToken);
            }
            finally
            {
                gate.Release();
            }
        }
        finally
        {
            lock (_inFlightLock)
            {
                _inFlight.Remove(dcId);
            }
        }
    }

    /// <summary>
    /// Writes every flag, segment and secret of the snapshot to one DC, prunes what that DC still lists although the
    /// snapshot no longer has it, and tells the DC's clients to refresh. A flag or segment that a prune removed after the
    /// snapshot was taken is not written back. Returns the number of writes that were accepted plus the entries pruned.
    /// </summary>
    private async Task<int> RunBackfillAsync(
        string dcId,
        ConsistencyMode mode,
        CommittedSnapshot snapshot,
        CompositeRedisCacheService composite,
        IDcLease? lease,
        CancellationToken cancellationToken)
    {
        // #105: "repaired" must report writes the only-advance guard actually ACCEPTED, not merely
        // attempted — the guard scripts (#89) already return 1/0 accept signals; this loop is what
        // stops that signal from being discarded. A flag/segment counts as accepted only if EVERY
        // targeted write in its sequence was accepted (GatedCommit: stage AND commit; BestEffort:
        // the single upsert) — a guard-rejected commit (the DC already held an equal/fresher
        // committed version) must not be reported as a repair, matching the #92 comments' original
        // (previously unenforced) intent.
        // A snapshot without a time is taken to be as old as this run.
        var snapshotTakenAt = snapshot.TakenAt ?? _time.GetUtcNow();

        // What prunes on any replica removed from this DC. The lock is held for the whole run, so no prune adds to it
        // meanwhile and one read is enough.
        var sharedPruned = lease is { IsHeld: true }
            ? await lease.ReadPrunedAsync(_time.GetUtcNow() - PrunedMarkerRetention)
            : NoSharedMarkers;

        var acceptedFlags = 0;
        foreach (var flag in snapshot.Flags)
        {
            cancellationToken.ThrowIfCancellationRequested();

            // Something a prune removed from this DC after the snapshot was read must not be written back from it.
            if (WasPrunedSince(dcId, flag.Id, snapshotTakenAt, sharedPruned))
            {
                logger.LogDebug(
                    "DC backfill: not writing flag {FlagId} to DC {DcId}; a prune removed it after the snapshot was taken.",
                    flag.Id,
                    dcId);
                continue;
            }

            // Version token mirrors how FeatureFlagChangeMessageHandler derives the staged version
            // from the flag's UpdatedAt.
            var ts = new DateTimeOffset(flag.UpdatedAt).ToUnixTimeMilliseconds();

            bool accepted;
            if (mode == ConsistencyMode.GatedCommit)
            {
                // Stage the versioned value, then flip the committed pointer + index — targeted at
                // ONLY this DC. Idempotent: re-applying an already-present version no-ops.
                var staged = await composite.StageFlagToDcAsync(dcId, flag, ts);
                var committed = await composite.CommitFlagToDcAsync(dcId, flag.EnvId, flag.Id.ToString(), ts);
                accepted = staged && committed;
            }
            else
            {
                // BestEffort: write the legacy value key the BestEffort eval reads.
                accepted = await composite.UpsertFlagToDcAsync(dcId, flag);
            }

            if (accepted)
            {
                acceptedFlags++;
            }
        }

        var acceptedSegments = 0;
        foreach (var segment in snapshot.Segments)
        {
            cancellationToken.ThrowIfCancellationRequested();

            if (WasPrunedSince(dcId, segment.Id, snapshotTakenAt, sharedPruned))
            {
                logger.LogDebug(
                    "DC backfill: not writing segment {SegmentId} to DC {DcId}; a prune removed it after the snapshot was taken.",
                    segment.Id,
                    dcId);
                continue;
            }

            var ts = new DateTimeOffset(segment.UpdatedAt).ToUnixTimeMilliseconds();
            var envIds = snapshot.SegmentEnvIds[segment.Id.ToString()];

            bool accepted;
            if (mode == ConsistencyMode.GatedCommit)
            {
                var staged = await composite.StageSegmentToDcAsync(dcId, segment, ts);
                var committed = await composite.CommitSegmentToDcAsync(dcId, envIds, segment.Id.ToString(), ts);
                accepted = staged && committed;
            }
            else
            {
                accepted = await composite.UpsertSegmentToDcAsync(dcId, envIds, segment);
            }

            if (accepted)
            {
                acceptedSegments++;
            }
        }

        // Secrets (#91) are NOT mode-gated and NOT guarded (#105 out of scope: there is no version
        // to compare — see UpsertSecretToDcAsync's own doc): unlike flags/segments there is no
        // staged/committed lifecycle for them (the cache shape is a last-write-wins hash keyed by
        // the secret's own value, not by env+id), so they are written unconditionally in BOTH
        // GatedCommit and BestEffort. Without this, a DC whose Redis lost its secret keys keeps
        // failing SDK auth even after flags/segments are healed (the eval server's secret lookup has
        // no DB fallback).
        foreach (var secretCache in snapshot.Secrets)
        {
            cancellationToken.ThrowIfCancellationRequested();

            await composite.UpsertSecretToDcAsync(dcId, secretCache.Descriptor, secretCache.Secret);
        }

        // Remove what this DC still lists for flags and segments the source of truth no longer has, i.e.
        // a delete this DC missed (see PruneDeletedAsync). A failure here must not fail the backfill that
        // already repaired the DC, so it is logged and the backfill carries on.
        var pruned = await PruneSafelyAsync(dcId, mode, snapshot, composite, lease, cancellationToken);

        // #105: report ACCEPTED vs ATTEMPTED so the log is honest about how much of this backfill
        // actually changed state — a DC that was already fully synced legitimately shows 0/N
        // accepted, which is not a failure.
        logger.LogInformation(
            "DC backfill: repaired DC {DcId} ({Mode}) from source of truth: {AcceptedFlags}/{AttemptedFlags} " +
            "flag(s) accepted, {AcceptedSegments}/{AttemptedSegments} segment(s) accepted, " +
            "{SecretCount} secret(s) upserted (unconditional, not guarded), and {PrunedCount} deleted " +
            "flag(s)/segment(s) removed.",
            dcId,
            mode,
            acceptedFlags,
            snapshot.Flags.Count,
            acceptedSegments,
            snapshot.Segments.Count,
            snapshot.Secrets.Count,
            pruned);

        await PublishClientRefreshAsync(dcId);

        // #105: the returned "repaired" signal is the TOTAL count of genuine writes this run made —
        // accepted flags + accepted segments (both guard-filtered, #89) PLUS every secret written
        // (secrets carry no version to guard on, so an attempted secret write always "accepts" — see
        // the comment above). This is deliberately broader than "accepted flags alone": a DC whose
        // ONLY genuine repair this tick was e.g. 2 secrets (its flags/segments were already in sync)
        // must still be reported as repaired by callers gating on "result > 0" (RecoveryWorker,
        // CacheReconciler) — it's real work, just not on the flag/segment axis. Conversely, a DC
        // whose Redis already matched the source of truth for EVERY flag/segment and had NO secrets
        // to write returns a legitimate 0 (not Skipped) — that DC needed no repair at all.
        return acceptedFlags + acceptedSegments + snapshot.Secrets.Count + pruned;
    }

    /// <summary>
    /// Removes the flags and segments a DC still lists although the source of truth no longer has them: a
    /// delete that never reached this DC, for example because its Redis was unreachable when the delete was
    /// relayed. The backfill only ever writes, so without this such an object stays in that DC for good.
    /// <para>
    /// This is destructive, so an entry is removed only when ALL of these hold:
    /// </para>
    /// <list type="bullet">
    /// <item>the snapshot does not hold it, and the snapshot is not empty (an empty read is never taken to
    /// mean that everything was deleted);</item>
    /// <item>its index score is older than <c>MinAgeSeconds</c>, so an object created or changed after the
    /// snapshot was read is never taken for a deleted one;</item>
    /// <item>this DC's value for it is archived, because every delete requires an archive first;</item>
    /// <item>the database is asked again right before the removal and still does not have it.</item>
    /// </list>
    /// If more than <c>MaxRemovalsPerRun</c> entries qualify, none is removed: that many at once points at the
    /// snapshot rather than at missed deletes. <c>Mode</c> can switch the whole step off or to a dry run that
    /// only logs what it would remove.
    /// <para>
    /// An entry that was left for later, because it is still too recent or because an index could not be read,
    /// is not forgotten: the outcome says when to look again (see <see cref="TakeDcsDueForPrune"/>). A segment
    /// is never removed while any environment's segment index could not be read, because it may be listed there
    /// too and would be left behind; an index that could not be read is not the same as an empty one.
    /// </para>
    /// </summary>
    private async Task<PruneOutcome> PruneDeletedAsync(
        string dcId,
        ConsistencyMode mode,
        CommittedSnapshot snapshot,
        CompositeRedisCacheService composite,
        IDcLease? lease,
        CancellationToken cancellationToken)
    {
        var pruneMode = ReadPruneMode(logInvalid: true);
        if (pruneMode == PruneMode.Off)
        {
            return new PruneOutcome(0, null);
        }

        // Without the DC's lock, a backfill on another replica could write back what this removes, so nothing is
        // removed and the prune looks again in a minute.
        if (lease is { IsHeld: false })
        {
            logger.LogWarning("DC backfill: DC {DcId}'s lock is not held; not pruning it now.", dcId);
            return new PruneOutcome(0, _time.GetUtcNow().AddSeconds(UnreadableIndexRetrySeconds));
        }

        if (snapshot.Flags.Count == 0 && snapshot.Segments.Count == 0)
        {
            logger.LogDebug(
                "DC backfill: the snapshot holds no flags or segments; not pruning DC {DcId}.", dcId);
            return new PruneOutcome(0, null);
        }

        var configuredMax = configuration.GetValue<int?>($"{PruneSection}:MaxRemovalsPerRun");
        var maxRemovals = configuredMax is > 0 ? configuredMax.Value : DefaultMaxRemovalsPerRun;
        var configuredAge = configuration.GetValue<int?>($"{PruneSection}:MinAgeSeconds");
        var minAgeSeconds = configuredAge is >= 0 ? configuredAge.Value : DefaultMinAgeSeconds;
        var now = _time.GetUtcNow();
        var cutoff = now.AddSeconds(-minAgeSeconds).ToUnixTimeMilliseconds();

        // The earliest time at which something left for later is worth another look.
        DateTimeOffset? retryAt = null;
        void Defer(DateTimeOffset when) => retryAt = retryAt is { } current && current <= when ? current : when;

        // A score is too recent until it is MinAgeSeconds old; look again a second after that.
        void DeferTooNew(long score) =>
            Defer(DateTimeOffset.FromUnixTimeMilliseconds(score).AddSeconds(minAgeSeconds + 1));

        // An environment list that could not be read may have left out an environment with nothing else left; the ones
        // known are still checked, and the prune looks again in a minute.
        if (snapshot.EnvironmentListUnreadable)
        {
            Defer(now.AddSeconds(UnreadableIndexRetrySeconds));
        }

        // Every environment the source of truth knows: the environment list, which includes one with no flags,
        // segments or SDK keys left, plus any environment the flags, segments and secrets refer to.
        var envIds = (snapshot.EnvironmentIds ?? [])
            .Concat(snapshot.Flags.Select(f => f.EnvId))
            .Concat(snapshot.SegmentEnvIds.Values.SelectMany(ids => ids))
            .Concat(snapshot.Secrets.Select(s => s.Descriptor.Environment.Id))
            .ToHashSet();
        var liveFlagIds = snapshot.Flags.Select(f => f.Id).ToHashSet();
        var liveSegmentIds = snapshot.Segments.Select(s => s.Id).ToHashSet();

        // 1. Entries this DC lists that the snapshot does not hold and that are old enough.
        var flagCandidates = new List<(Guid EnvId, Guid Id)>();
        var segmentEnvs = new Dictionary<Guid, List<Guid>>();
        var segmentsTooNew = new HashSet<Guid>();
        var segmentIndexUnreadable = false;
        foreach (var envId in envIds)
        {
            cancellationToken.ThrowIfCancellationRequested();

            var flagIndex = await composite.GetFlagIndexFromDcAsync(dcId, envId);
            if (flagIndex is null)
            {
                Defer(now.AddSeconds(UnreadableIndexRetrySeconds));
            }

            foreach (var (id, score) in flagIndex ?? new Dictionary<Guid, long>())
            {
                if (liveFlagIds.Contains(id))
                {
                    continue;
                }

                if (score >= cutoff)
                {
                    DeferTooNew(score);
                    continue;
                }

                flagCandidates.Add((envId, id));
            }

            var segmentIndex = await composite.GetSegmentIndexFromDcAsync(dcId, envId);
            if (segmentIndex is null)
            {
                segmentIndexUnreadable = true;
                Defer(now.AddSeconds(UnreadableIndexRetrySeconds));
            }

            foreach (var (id, score) in segmentIndex ?? new Dictionary<Guid, long>())
            {
                if (liveSegmentIds.Contains(id))
                {
                    continue;
                }

                if (score >= cutoff)
                {
                    DeferTooNew(score);
                    segmentsTooNew.Add(id);
                    continue;
                }

                if (!segmentEnvs.TryGetValue(id, out var envs))
                {
                    segmentEnvs[id] = envs = [];
                }

                envs.Add(envId);
            }
        }

        // A segment can be listed in several environments; one that is too new in any of them is left alone.
        foreach (var id in segmentsTooNew)
        {
            segmentEnvs.Remove(id);
        }

        // An index that could not be read may list a segment that is listed elsewhere too. Removing it from the
        // environments that were read would leave it behind in that one, so no segment is removed until every
        // index can be read.
        if (segmentIndexUnreadable && segmentEnvs.Count > 0)
        {
            logger.LogWarning(
                "DC backfill: a segment index of DC {DcId} could not be read; not removing deleted segments " +
                "until every index can be read.",
                dcId);
            segmentEnvs.Clear();
        }

        // Entries whose removal from this DC failed part way. The index may no longer list them, so they are carried
        // over from that run rather than found again; their archived state was confirmed then, and their value may be
        // gone now, so only the database is asked again. A record is dropped only when the removal succeeds or the
        // database has the entry again. A snapshot that still holds the entry (one read before the delete, by a backfill
        // that waited for the prune) does not drop it; it is skipped on this pass and looked at again.
        var pendingFlags = new List<(Guid EnvId, Guid Id, bool InSnapshot)>();
        foreach (var ((pendingDcId, id), envId) in _pendingFlagRemovals)
        {
            if (pendingDcId != dcId)
            {
                continue;
            }

            flagCandidates.Remove((envId, id));
            pendingFlags.Add((envId, id, liveFlagIds.Contains(id)));
        }

        var pendingSegments = new List<(Guid Id, ICollection<Guid> EnvIds, bool InSnapshot)>();
        foreach (var ((pendingDcId, id), envs) in _pendingSegmentRemovals)
        {
            if (pendingDcId != dcId)
            {
                continue;
            }

            // The same rules as above: no segment is removed while an index could not be read, or while any environment
            // lists it with a recent score, which a later look covers once it ages. The record is kept for that look.
            if (segmentIndexUnreadable || segmentsTooNew.Contains(id))
            {
                continue;
            }

            var allEnvs = segmentEnvs.Remove(id, out var listed) ? envs.Union(listed).ToList() : envs;
            pendingSegments.Add((id, allEnvs, liveSegmentIds.Contains(id)));
        }

        if (flagCandidates.Count == 0 && segmentEnvs.Count == 0 && pendingFlags.Count == 0 && pendingSegments.Count == 0)
        {
            return new PruneOutcome(0, retryAt);
        }

        // 2. Confirm: archived in this DC, and still absent from the database right now. The scope is only
        // created when there is something to confirm.
        using var scope = scopeFactory.CreateScope();
        var featureFlagService = scope.ServiceProvider.GetRequiredService<IFeatureFlagService>();
        var segmentService = scope.ServiceProvider.GetRequiredService<ISegmentService>();

        var flagsToRemove = new List<(Guid EnvId, Guid Id)>();
        foreach (var (envId, id) in flagCandidates)
        {
            cancellationToken.ThrowIfCancellationRequested();

            // An archived state that could not be read is not a "no": nothing is removed, and it is looked at again.
            var archived = await composite.IsFlagArchivedInDcAsync(dcId, id, mode);
            if (archived is null)
            {
                Defer(now.AddSeconds(UnreadableIndexRetrySeconds));
                continue;
            }

            if (archived.Value && !await featureFlagService.AnyAsync(f => f.Id == id))
            {
                flagsToRemove.Add((envId, id));
            }
        }

        foreach (var (envId, id, inSnapshot) in pendingFlags)
        {
            cancellationToken.ThrowIfCancellationRequested();

            if (await featureFlagService.AnyAsync(f => f.Id == id))
            {
                _pendingFlagRemovals.TryRemove((dcId, id), out _);
                continue;
            }

            if (inSnapshot)
            {
                Defer(now.AddSeconds(UnreadableIndexRetrySeconds));
                continue;
            }

            flagsToRemove.Add((envId, id));
        }

        var segmentsToRemove = new List<(Guid Id, ICollection<Guid> EnvIds)>();
        foreach (var (id, envs) in segmentEnvs)
        {
            cancellationToken.ThrowIfCancellationRequested();

            var archived = await composite.IsSegmentArchivedInDcAsync(dcId, id, mode);
            if (archived is null)
            {
                Defer(now.AddSeconds(UnreadableIndexRetrySeconds));
                continue;
            }

            if (archived.Value && !await segmentService.AnyAsync(s => s.Id == id))
            {
                segmentsToRemove.Add((id, envs));
            }
        }

        foreach (var (id, envs, inSnapshot) in pendingSegments)
        {
            cancellationToken.ThrowIfCancellationRequested();

            if (await segmentService.AnyAsync(s => s.Id == id))
            {
                _pendingSegmentRemovals.TryRemove((dcId, id), out _);
                continue;
            }

            if (inSnapshot)
            {
                Defer(now.AddSeconds(UnreadableIndexRetrySeconds));
                continue;
            }

            segmentsToRemove.Add((id, envs));
        }

        var total = flagsToRemove.Count + segmentsToRemove.Count;
        if (total == 0)
        {
            return new PruneOutcome(0, retryAt);
        }

        if (total > maxRemovals)
        {
            logger.LogWarning(
                "DC backfill: {Total} deleted flag(s)/segment(s) are still listed by DC {DcId}, more than the " +
                "limit of {Limit} per run; removing none. Check the source of truth, or raise {Setting}.",
                total,
                dcId,
                maxRemovals,
                $"{PruneSection}:MaxRemovalsPerRun");
            return new PruneOutcome(0, retryAt);
        }

        if (pruneMode == PruneMode.DryRun)
        {
            logger.LogInformation(
                "DC backfill (dry run): DC {DcId} still lists {FlagCount} deleted flag(s) ({FlagIds}) and " +
                "{SegmentCount} deleted segment(s) ({SegmentIds}); nothing removed.",
                dcId,
                flagsToRemove.Count,
                flagsToRemove.Select(f => f.Id),
                segmentsToRemove.Count,
                segmentsToRemove.Select(s => s.Id));
            return new PruneOutcome(0, retryAt);
        }

        // 3. Remove, in this DC only. If the DC's lock is lost part way, another replica may be writing to the DC, so the
        // rest waits for the next look.
        bool LockLost()
        {
            if (lease is not { IsHeld: false })
            {
                return false;
            }

            logger.LogWarning("DC backfill: lost DC {DcId}'s lock while pruning; stopping until the next look.", dcId);
            Defer(now.AddSeconds(UnreadableIndexRetrySeconds));
            return true;
        }

        // Every replica's backfill reads the DC's shared record of what was pruned, so the removal is recorded there
        // first; an entry whose removal could not be recorded is not removed, and is looked at again.
        async Task<bool> RecordPrunedAsync(Guid id)
        {
            if (lease is null || await lease.RecordPrunedAsync(id, _time.GetUtcNow()))
            {
                return true;
            }

            Defer(now.AddSeconds(UnreadableIndexRetrySeconds));
            return false;
        }

        var removed = 0;
        foreach (var (envId, id) in flagsToRemove)
        {
            if (LockLost())
            {
                return new PruneOutcome(removed, retryAt);
            }

            if (!await RecordPrunedAsync(id))
            {
                continue;
            }

            MarkPruned(dcId, id); // before the delete, so a backfill with an older snapshot does not write it back
            if (await composite.DeleteFlagFromDcAsync(dcId, envId, id))
            {
                _pendingFlagRemovals.TryRemove((dcId, id), out _);
                removed++;
                logger.LogInformation(
                    "DC backfill: removed deleted flag {FlagId} from DC {DcId}.", id, dcId);
            }
            else
            {
                // Not removed, or only in part: the index entry may be gone while the value is not. Remember it, so
                // the next look finishes the removal even though the index no longer lists it.
                _pendingFlagRemovals[(dcId, id)] = envId;
                Defer(now.AddSeconds(UnreadableIndexRetrySeconds));
            }
        }

        foreach (var (id, envs) in segmentsToRemove)
        {
            if (LockLost())
            {
                return new PruneOutcome(removed, retryAt);
            }

            if (!await RecordPrunedAsync(id))
            {
                continue;
            }

            MarkPruned(dcId, id);
            if (await composite.DeleteSegmentFromDcAsync(dcId, envs, id))
            {
                _pendingSegmentRemovals.TryRemove((dcId, id), out _);
                removed++;
                logger.LogInformation(
                    "DC backfill: removed deleted segment {SegmentId} from DC {DcId}.", id, dcId);
            }
            else
            {
                _pendingSegmentRemovals[(dcId, id)] = envs;
                Defer(now.AddSeconds(UnreadableIndexRetrySeconds));
            }
        }

        return new PruneOutcome(removed, retryAt);
    }

    /// <summary>
    /// Runs <see cref="PruneDeletedAsync"/> and records when this DC's prune is due again. A failure here must
    /// not fail a backfill that already repaired the DC, so it is logged and retried in a minute.
    /// </summary>
    private async Task<int> PruneSafelyAsync(
        string dcId,
        ConsistencyMode mode,
        CommittedSnapshot snapshot,
        CompositeRedisCacheService composite,
        IDcLease? lease,
        CancellationToken cancellationToken)
    {
        // A snapshot without a time is taken to be as new as this run, as the backfill does.
        var snapshotTakenAt = snapshot.TakenAt ?? _time.GetUtcNow();

        try
        {
            var outcome = await PruneDeletedAsync(dcId, mode, snapshot, composite, lease, cancellationToken);
            RecordPruneOutcome(dcId, snapshotTakenAt, outcome.RetryAt);
            return outcome.Removed;
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (Exception ex)
        {
            logger.LogError(
                ex, "DC backfill: pruning deleted flags and segments from DC {DcId} failed; will retry.", dcId);
            RecordPruneOutcome(dcId, snapshotTakenAt, _time.GetUtcNow().AddSeconds(UnreadableIndexRetrySeconds));
            return 0;
        }
    }

    /// <summary>
    /// Records when a prune wants another look at its DC. A prune from a snapshot strictly newer than any seen so far for
    /// this DC sets or clears the schedule. One from an older snapshot, or one taken in the same clock tick, such as a backfill that read the database before a later
    /// prune-only pass did, may bring the schedule forward but never clears or delays it: an entry it saw as live may have
    /// been deleted since, and a newer prune may have left it for later. The check and the change happen under one lock.
    /// </summary>
    private void RecordPruneOutcome(string dcId, DateTimeOffset snapshotTakenAt, DateTimeOffset? retryAt)
    {
        lock (_pruneScheduleLock)
        {
            // Strictly newer: two snapshots taken in the same clock tick cannot be ordered, so a tie keeps the schedule
            // (at worst one extra prune) rather than letting either clear the other's retry.
            var isNewest = !_newestPruneSnapshot.TryGetValue(dcId, out var newest) || snapshotTakenAt > newest;
            if (isNewest)
            {
                _newestPruneSnapshot[dcId] = snapshotTakenAt;
            }

            var hasSchedule = _pruneDueAt.TryGetValue(dcId, out var existing);
            if (retryAt is { } at)
            {
                if (isNewest || !hasSchedule || at < existing)
                {
                    _pruneDueAt[dcId] = at;
                }
            }
            else if (isNewest)
            {
                _pruneDueAt.Remove(dcId);
            }
        }
    }

    /// <summary>
    /// Notes that a prune removed <paramref name="id"/> from <paramref name="dcId"/> now, and drops markers old
    /// enough that no snapshot still being applied could predate them.
    /// </summary>
    private void MarkPruned(string dcId, Guid id)
    {
        var now = _time.GetUtcNow();
        _prunedAt[(dcId, id)] = now;

        foreach (var (key, prunedAt) in _prunedAt)
        {
            if (now - prunedAt > PrunedMarkerRetention)
            {
                _prunedAt.TryRemove(key, out _);
            }
        }
    }

    /// <summary>
    /// Whether a prune removed <paramref name="id"/> from <paramref name="dcId"/> after
    /// <paramref name="snapshotTakenAt"/>, so that a snapshot taken then must not write it back.
    /// <para>
    /// <paramref name="sharedPruned"/> is the DC's record of what prunes on any replica removed. Those times come from
    /// another replica's clock, so they are compared with a margin for clock skew: an entry pruned up to
    /// <see cref="SharedMarkerClockSkew"/> before the snapshot was taken is also skipped. Skipping is the safe side, since
    /// a pruned entry was confirmed absent from the database and ids are never reused.
    /// </para>
    /// </summary>
    private bool WasPrunedSince(
        string dcId, Guid id, DateTimeOffset snapshotTakenAt, IReadOnlyDictionary<Guid, DateTimeOffset> sharedPruned) =>
        (_prunedAt.TryGetValue((dcId, id), out var prunedAt) && prunedAt > snapshotTakenAt)
        || (sharedPruned.TryGetValue(id, out var sharedAt) && sharedAt > snapshotTakenAt - SharedMarkerClockSkew);

    private static readonly TimeSpan SharedMarkerClockSkew = TimeSpan.FromMinutes(1);

    private static readonly IReadOnlyDictionary<Guid, DateTimeOffset> NoSharedMarkers = new Dictionary<Guid, DateTimeOffset>();

    /// <summary>
    /// Reads the prune mode. A dry run when the setting is absent or blank: the step reports what it would remove and
    /// removes nothing until it is switched on. A value that is not exactly one of the mode names is a mistake (a typo, a
    /// number, or a list such as "Off, On", which Enum.TryParse would accept and combine into On), and it must not turn on
    /// a destructive step, so it switches the step off and, when <paramref name="logInvalid"/> is set, says so.
    /// </summary>
    private PruneMode ReadPruneMode(bool logInvalid)
    {
        var rawMode = configuration[$"{PruneSection}:Mode"];
        if (string.IsNullOrWhiteSpace(rawMode))
        {
            return PruneMode.DryRun;
        }

        var name = Enum.GetNames<PruneMode>()
            .FirstOrDefault(n => string.Equals(n, rawMode.Trim(), StringComparison.OrdinalIgnoreCase));
        if (name is not null)
        {
            return Enum.Parse<PruneMode>(name);
        }

        if (logInvalid)
        {
            logger.LogWarning(
                "DC backfill: {Setting} has the invalid value '{Value}'; pruning is off until it is fixed.",
                $"{PruneSection}:Mode",
                rawMode);
        }

        return PruneMode.Off;
    }

    private readonly record struct PruneOutcome(int Removed, DateTimeOffset? RetryAt);

    private enum PruneMode
    {
        Off,
        DryRun,
        On
    }

    /// <summary>
    /// Fetch a fresh <see cref="CommittedSnapshot"/>: every committed flag, every committed segment,
    /// each committed segment's resolved target env ids (a DB lookup, resolved once here —
    /// independent of any DC being repaired), and every secret cache entry (#91, enumerated the same
    /// way as the api-server's <c>RedisPopulatingService.PopulateSecretsAsync</c> via
    /// <see cref="IEnvironmentService.GetSecretCachesAsync"/>). Callers backfilling multiple DCs in
    /// one tick should call this ONCE and share the result (#90); see
    /// <see cref="RecoveryWorker.RunOnceAsync"/> and <see cref="CacheReconciler.RunOnceAsync"/>.
    /// </summary>
    public async Task<CommittedSnapshot> FetchCommittedSnapshotAsync(CancellationToken cancellationToken = default)
    {
        // IFeatureFlagService / ISegmentService / IEnvironmentService are scoped (per-request) in DI;
        // resolve them inside a scope so a singleton caller does not capture a scoped/disposed instance.
        using var scope = scopeFactory.CreateScope();
        var featureFlagService = scope.ServiceProvider.GetRequiredService<IFeatureFlagService>();
        var segmentService = scope.ServiceProvider.GetRequiredService<ISegmentService>();
        var environmentService = scope.ServiceProvider.GetRequiredService<IEnvironmentService>();

        // Taken before anything is read, so it is never later than the state the snapshot shows.
        var takenAt = _time.GetUtcNow();

        var allCommitted = await featureFlagService.GetAllCommittedAsync();
        var allCommittedSegments = await segmentService.GetAllCommittedAsync();

        // Resolve each committed segment's target env ids once (independent of the DC being repaired).
        var segmentEnvIds = new Dictionary<string, ICollection<Guid>>(allCommittedSegments.Count);
        foreach (var segment in allCommittedSegments)
        {
            cancellationToken.ThrowIfCancellationRequested();
            segmentEnvIds[segment.Id.ToString()] = await segmentService.GetEnvironmentIdsAsync(segment);
        }

        var secretCaches = await environmentService.GetSecretCachesAsync();

        // Every environment, so that the prune step also checks one with no flags, segments or secrets left. Only the
        // prune uses it, so it is not read while pruning is off, and a failed read must not fail the backfill: the
        // snapshot then says the list is missing, and the prune checks the environments it knows of and looks again.
        IReadOnlyCollection<Guid>? environmentIds = null;
        var environmentListUnreadable = false;
        if (ReadPruneMode(logInvalid: false) != PruneMode.Off)
        {
            try
            {
                environmentIds = (await environmentService.FindManyAsync(_ => true)).Select(e => e.Id).ToList();
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                logger.LogWarning(
                    ex, "DC backfill: the environment list could not be read; the prune will look again.");
                environmentListUnreadable = true;
            }
        }

        return new CommittedSnapshot(
            allCommitted,
            allCommittedSegments,
            segmentEnvIds,
            secretCaches.ToList(),
            takenAt,
            environmentIds,
            environmentListUnreadable);
    }

    /// <summary>
    /// Resolve <see cref="compositeCache"/> to the concrete <see cref="CompositeRedisCacheService"/>
    /// the targeted writes need, logging + returning <c>false</c> (instead of throwing) if the composite
    /// cache is misconfigured (e.g. a <c>None</c> cache provider).
    /// </summary>
    private bool TryGetComposite(string dcId, out CompositeRedisCacheService composite)
    {
        if (compositeCache is CompositeRedisCacheService redisComposite)
        {
            composite = redisComposite;
            return true;
        }

        logger.LogWarning(
            "DC backfill requires the composite Redis cache (got {CacheType}); skipping backfill for DC {DcId}.",
            compositeCache.GetType().FullName,
            dcId);
        composite = null!;
        return false;
    }

    /// <summary>
    /// Best-effort: publish a <see cref="Action.PushFullSync"/> command scoped to
    /// <paramref name="dcId"/> so only that DC's eval servers refresh their connected SDK clients
    /// after the backfill. A publish failure is logged and swallowed — it must not fail the backfill
    /// that already repaired the DC's Redis.
    /// </summary>
    private async Task PublishClientRefreshAsync(string dcId)
    {
        try
        {
            await messageProducer.PublishAsync(
                ControlPlaneTopics.ControlPlaneCommand,
                new ControlPlaneCommand { Action = Action.PushFullSync, TargetDcId = dcId });
        }
        catch (Exception ex)
        {
            logger.LogError(
                ex,
                "DC backfill: failed to publish per-DC client refresh (PushFullSync) for DC {DcId}. " +
                "Backfill succeeded; clients on that DC will refresh on their next reconnect.",
                dcId);
        }
    }
}
