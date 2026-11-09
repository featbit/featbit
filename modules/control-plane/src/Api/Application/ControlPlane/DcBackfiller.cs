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
/// </summary>
public sealed record CommittedSnapshot(
    IReadOnlyList<FeatureFlag> Flags,
    IReadOnlyList<Segment> Segments,
    IReadOnlyDictionary<string, ICollection<Guid>> SegmentEnvIds,
    IReadOnlyList<SecretCache> Secrets);

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
    /// truth no longer has them. Returns the number removed, or <see cref="Skipped"/> if the composite cache is
    /// unavailable or a backfill or prune of this DcId is already in flight.
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
    TimeProvider? timeProvider = null) : IDcBackfiller
{
    private const string PruneSection = "ControlPlane:CacheReconcile:PruneDeleted";
    private const int DefaultMaxRemovalsPerRun = 200;
    private const int DefaultMinAgeSeconds = 600;
    private const int UnreadableIndexRetrySeconds = 60;

    private readonly TimeProvider _time = timeProvider ?? TimeProvider.System;

    // When a DC's prune is due again: it left entries for later, either too recent to remove yet or in an
    // index it could not read. Nothing else would come back for them, because a backfill only runs when a DC
    // becomes reachable.
    private readonly System.Collections.Concurrent.ConcurrentDictionary<string, DateTimeOffset> _pruneDueAt = new();

    // #92: DcIds with a backfill currently running, shared across EVERY caller (RecoveryWorker and
    // CacheReconciler both hold a reference to this same singleton), so the two workers coalesce
    // against each other instead of each maintaining their own (previously CacheReconciler-only)
    // in-flight set.
    private readonly object _inFlightLock = new();
    private readonly HashSet<string> _inFlight = new();

    public bool IsCompositeCacheAvailable => compositeCache is CompositeRedisCacheService;

    public IEnumerable<string> TakeDcsDueForPrune()
    {
        var now = _time.GetUtcNow();
        var due = new List<string>();
        foreach (var (dcId, dueAt) in _pruneDueAt)
        {
            if (dueAt <= now && _pruneDueAt.TryUpdate(dcId, now.AddSeconds(UnreadableIndexRetrySeconds), dueAt))
            {
                due.Add(dcId);
            }
        }

        return due;
    }

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

        // Share the in-flight slot with the backfill of the same DC, so the two never run at once.
        lock (_inFlightLock)
        {
            if (!_inFlight.Add(dcId))
            {
                logger.LogDebug("DC prune: a backfill or prune for DC {DcId} is already in flight; skipping.", dcId);
                return IDcBackfiller.Skipped;
            }
        }

        try
        {
            return await PruneSafelyAsync(dcId, mode, snapshot, composite, cancellationToken);
        }
        finally
        {
            lock (_inFlightLock)
            {
                _inFlight.Remove(dcId);
            }
        }
    }

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
            return await RunBackfillAsync(dcId, mode, snapshot, composite, cancellationToken);
        }
        finally
        {
            lock (_inFlightLock)
            {
                _inFlight.Remove(dcId);
            }
        }
    }

    private async Task<int> RunBackfillAsync(
        string dcId,
        ConsistencyMode mode,
        CommittedSnapshot snapshot,
        CompositeRedisCacheService composite,
        CancellationToken cancellationToken)
    {
        // #105: "repaired" must report writes the only-advance guard actually ACCEPTED, not merely
        // attempted — the guard scripts (#89) already return 1/0 accept signals; this loop is what
        // stops that signal from being discarded. A flag/segment counts as accepted only if EVERY
        // targeted write in its sequence was accepted (GatedCommit: stage AND commit; BestEffort:
        // the single upsert) — a guard-rejected commit (the DC already held an equal/fresher
        // committed version) must not be reported as a repair, matching the #92 comments' original
        // (previously unenforced) intent.
        var acceptedFlags = 0;
        foreach (var flag in snapshot.Flags)
        {
            cancellationToken.ThrowIfCancellationRequested();

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
        var pruned = await PruneSafelyAsync(dcId, mode, snapshot, composite, cancellationToken);

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
        CancellationToken cancellationToken)
    {
        var pruneMode = Enum.TryParse<PruneMode>(configuration[$"{PruneSection}:Mode"], ignoreCase: true, out var parsed)
            ? parsed
            : PruneMode.On;
        if (pruneMode == PruneMode.Off)
        {
            return new PruneOutcome(0, null);
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

        // Every environment the source of truth knows. An environment whose flags were all deleted still
        // has its SDK keys, so it is found through its secrets.
        var envIds = snapshot.Flags.Select(f => f.EnvId)
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

        if (flagCandidates.Count == 0 && segmentEnvs.Count == 0)
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

            if (await composite.IsFlagArchivedInDcAsync(dcId, id, mode) && !await featureFlagService.AnyAsync(f => f.Id == id))
            {
                flagsToRemove.Add((envId, id));
            }
        }

        var segmentsToRemove = new List<(Guid Id, ICollection<Guid> EnvIds)>();
        foreach (var (id, envs) in segmentEnvs)
        {
            cancellationToken.ThrowIfCancellationRequested();

            if (await composite.IsSegmentArchivedInDcAsync(dcId, id, mode) && !await segmentService.AnyAsync(s => s.Id == id))
            {
                segmentsToRemove.Add((id, envs));
            }
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

        // 3. Remove, in this DC only.
        var removed = 0;
        foreach (var (envId, id) in flagsToRemove)
        {
            if (await composite.DeleteFlagFromDcAsync(dcId, envId, id))
            {
                removed++;
                logger.LogInformation(
                    "DC backfill: removed deleted flag {FlagId} from DC {DcId}.", id, dcId);
            }
        }

        foreach (var (id, envs) in segmentsToRemove)
        {
            if (await composite.DeleteSegmentFromDcAsync(dcId, envs, id))
            {
                removed++;
                logger.LogInformation(
                    "DC backfill: removed deleted segment {SegmentId} from DC {DcId}.", id, dcId);
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
        CancellationToken cancellationToken)
    {
        try
        {
            var outcome = await PruneDeletedAsync(dcId, mode, snapshot, composite, cancellationToken);
            if (outcome.RetryAt is { } retryAt)
            {
                _pruneDueAt[dcId] = retryAt;
            }
            else
            {
                _pruneDueAt.TryRemove(dcId, out _);
            }

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
            _pruneDueAt[dcId] = _time.GetUtcNow().AddSeconds(UnreadableIndexRetrySeconds);
            return 0;
        }
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

        return new CommittedSnapshot(
            allCommitted,
            allCommittedSegments,
            segmentEnvIds,
            secretCaches.ToList());
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
