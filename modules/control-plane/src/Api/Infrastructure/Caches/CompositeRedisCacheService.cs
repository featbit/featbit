using Application.Caches;
using Domain.Connections;
using Domain.ControlPlane;
using Domain.Environments;
using Domain.FeatureFlags;
using Domain.Segments;
using Domain.Workspaces;
using Infrastructure.Caches.Redis;

namespace Api.Infrastructure.Caches;

/// <summary>
/// Pairs a <see cref="ICacheService"/> (one DC's Redis) with the id of the DC it
/// serves, so broadcast results can be keyed by DcId rather than ordinal index.
/// </summary>
public record DcCacheService(string DcId, ICacheService Service);

public class CompositeRedisCacheService(
    IEnumerable<DcCacheService> cacheServices,
    ILogger<CompositeRedisCacheService> logger) : ICacheService
{
    // The public ICacheService methods keep returning Task and discard the
    // per-instance result map so externally observable behavior is unchanged
    // (swallow-and-continue). The map is surfaced only via the internal
    // BroadcastAsync for a future commit coordinator.
    public Task UpsertFlagAsync(FeatureFlag flag) =>
        BroadcastAsync(s => s.UpsertFlagAsync(flag), nameof(UpsertFlagAsync));

    // ICacheService contract member (#89): broadcasts the only-advance-guarded upsert to every DC.
    // Not used by the normal upsert flow (that's UpsertFlagAsync above) — this exists so
    // CompositeRedisCacheService satisfies ICacheService; the backfiller reaches the guard via the
    // TARGETED UpsertFlagToDcAsync below instead. #105: the interface now returns Task<bool>, so
    // this collapses BroadcastAsync's per-DC accept map down to a single bool ("every DC accepted")
    // — unused today (see above), so the exact reduction is not load-bearing.
    public async Task<bool> UpsertFlagIfNewerAsync(FeatureFlag flag)
    {
        var results = await BroadcastAsync(s => s.UpsertFlagIfNewerAsync(flag), nameof(UpsertFlagIfNewerAsync));
        return results.Values.All(accepted => accepted);
    }

    public async Task<bool> StageFlagAsync(FeatureFlag flag, long ts)
    {
        var results = await BroadcastAsync(s => s.StageFlagAsync(flag, ts), nameof(StageFlagAsync));
        return results.Values.All(accepted => accepted);
    }

    public async Task<bool> CommitFlagAsync(Guid envId, string flagId, long ts)
    {
        var results = await BroadcastAsync(s => s.CommitFlagAsync(envId, flagId, ts), nameof(CommitFlagAsync));
        return results.Values.All(accepted => accepted);
    }

    // ICacheService probe: returns the LOCAL DC's result (first instance), consistent with
    // the heartbeat/health local-first convention above. This is NOT the coordinator API —
    // the coordinator must use GetStagedDcsAsync to see EVERY DC's staged presence.
    public Task<bool> HasStagedFlagAsync(Guid id, long ts)
    {
        var local = cacheServices.First();
        return local.Service.HasStagedFlagAsync(id, ts);
    }

    public Task DeleteFlagAsync(Guid envId, Guid flagId) =>
        BroadcastAsync(s => s.DeleteFlagAsync(envId, flagId), nameof(DeleteFlagAsync));

    public Task UpsertSegmentAsync(ICollection<Guid> envIds, Segment segment) =>
        BroadcastAsync(s => s.UpsertSegmentAsync(envIds, segment), nameof(UpsertSegmentAsync));

    // ICacheService contract member (#89, segment counterpart of UpsertFlagIfNewerAsync above);
    // same rationale — the backfiller reaches the guard via the TARGETED UpsertSegmentToDcAsync.
    public async Task<bool> UpsertSegmentIfNewerAsync(ICollection<Guid> envIds, Segment segment)
    {
        var results = await BroadcastAsync(
            s => s.UpsertSegmentIfNewerAsync(envIds, segment), nameof(UpsertSegmentIfNewerAsync));
        return results.Values.All(accepted => accepted);
    }

    public async Task<bool> StageSegmentAsync(Segment segment, long ts)
    {
        var results = await BroadcastAsync(s => s.StageSegmentAsync(segment, ts), nameof(StageSegmentAsync));
        return results.Values.All(accepted => accepted);
    }

    public async Task<bool> CommitSegmentAsync(ICollection<Guid> envIds, string segmentId, long ts)
    {
        var results = await BroadcastAsync(
            s => s.CommitSegmentAsync(envIds, segmentId, ts), nameof(CommitSegmentAsync));
        return results.Values.All(accepted => accepted);
    }

    // ICacheService probe: returns the LOCAL DC's result (first instance), mirroring
    // HasStagedFlagAsync. This is NOT the coordinator API — the coordinator must use
    // GetStagedSegmentDcsAsync to see EVERY DC's staged presence.
    public Task<bool> HasStagedSegmentAsync(Guid id, long ts)
    {
        var local = cacheServices.First();
        return local.Service.HasStagedSegmentAsync(id, ts);
    }

    public Task DeleteSegmentAsync(ICollection<Guid> envIds, Guid segmentId) =>
        BroadcastAsync(s => s.DeleteSegmentAsync(envIds, segmentId), nameof(DeleteSegmentAsync));

    public Task UpsertLicenseAsync(Workspace workspace) =>
        BroadcastAsync(s => s.UpsertLicenseAsync(workspace), nameof(UpsertLicenseAsync));

    public Task UpsertSecretAsync(ResourceDescriptor resourceDescriptor, Secret secret) =>
        BroadcastAsync(s => s.UpsertSecretAsync(resourceDescriptor, secret), nameof(UpsertSecretAsync));

    public Task DeleteSecretAsync(Secret secret) =>
        BroadcastAsync(s => s.DeleteSecretAsync(secret), nameof(DeleteSecretAsync));

    public async Task<string> GetOrSetLicenseAsync(Guid workspaceId, Func<Task<string>> licenseGetter)
    {
        // Try each instance in order until one succeeds; write-through to all.
        var license = string.Empty;
        var succeeded = false;
        foreach (var dc in cacheServices)
        {
            try
            {
                license = await dc.Service.GetOrSetLicenseAsync(workspaceId, licenseGetter);
                succeeded = true;
                break;
            }
            catch (OperationCanceledException)
            {
                throw;
            }
            catch (Exception ex)
            {
                logger.LogError(
                    ex,
                    "Redis cache operation '{Operation}' failed for DC {DcId} (implementation {CacheService}). Trying next instance.",
                    nameof(GetOrSetLicenseAsync),
                    dc.DcId,
                    dc.Service.GetType().FullName);
            }
        }

        if (!succeeded)
        {
            throw new InvalidOperationException(
                $"All Redis cache instances failed for {nameof(GetOrSetLicenseAsync)}.");
        }

        await BroadcastAsync(
            s => s.GetOrSetLicenseAsync(workspaceId, () => Task.FromResult(license)),
            nameof(GetOrSetLicenseAsync));

        return license;
    }

    public Task UpsertConnectionMadeAsync(ConnectionMessage connectionMessage) =>
        BroadcastAsync(s => s.UpsertConnectionMadeAsync(connectionMessage), nameof(UpsertConnectionMadeAsync));

    public Task DeleteConnectionMadeAsync(ConnectionMessage connectionMessage) =>
        BroadcastAsync(s => s.DeleteConnectionMadeAsync(connectionMessage), nameof(DeleteConnectionMadeAsync));

    /// <summary>
    /// Broadcasts <paramref name="action"/> to every cache instance, swallowing and
    /// logging per-instance failures so one DC's outage does not fail the others.
    /// Returns a per-DC success map (keyed by DcId) so callers (e.g. a future commit
    /// coordinator) can observe partial failure instead of having it silently swallowed.
    /// </summary>
    internal async Task<IReadOnlyDictionary<string, bool>> BroadcastAsync(
        Func<ICacheService, Task> action,
        string operationName)
    {
        var instances = cacheServices.ToList();
        var tasks = instances
            .Select(dc => ExecuteSafelyAsync(dc, action, operationName))
            .ToList();

        var outcomes = await Task.WhenAll(tasks);

        var results = new Dictionary<string, bool>(outcomes.Length);
        for (var i = 0; i < outcomes.Length; i++)
        {
            results[instances[i].DcId] = outcomes[i];
        }

        return results;
    }

    /// <summary>
    /// Coordinator-facing probe: returns, per <see cref="DcCacheService.DcId"/>, whether that
    /// DC's Redis holds the staged version <c>flag:{id}:v{ts}</c>. Iterates every configured
    /// DC (unlike the local-first <see cref="HasStagedFlagAsync"/>) with the same
    /// swallow-and-continue resilience as <see cref="BroadcastAsync"/>: a DC whose probe throws
    /// is reported as <c>false</c> rather than failing the whole call.
    /// </summary>
    public Task<IReadOnlyDictionary<string, bool>> GetStagedDcsAsync(Guid id, long ts) =>
        ProbeStagedAsync(s => s.HasStagedFlagAsync(id, ts), "Staged-flag");

    /// <summary>
    /// Coordinator-facing probe (segment counterpart of <see cref="GetStagedDcsAsync"/>):
    /// returns, per <see cref="DcCacheService.DcId"/>, whether that DC's Redis holds the staged
    /// version <c>segment:{id}:v{ts}</c>. Iterates every configured DC (unlike the local-first
    /// <see cref="HasStagedSegmentAsync"/>) with the same swallow-and-continue resilience: a DC
    /// whose probe throws is reported as <c>false</c> rather than failing the whole call.
    /// </summary>
    public Task<IReadOnlyDictionary<string, bool>> GetStagedSegmentDcsAsync(Guid id, long ts) =>
        ProbeStagedAsync(s => s.HasStagedSegmentAsync(id, ts), "Staged-segment");

    /// <summary>
    /// Shared fan-out for the staged-probe methods above (#108 item 4): parameterizes the per-DC
    /// probe the same way <see cref="BroadcastAsync"/> parameterizes its per-DC action, instead of
    /// each probe re-implementing its own identical instances/tasks/outcomes-map plumbing. A DC
    /// whose probe throws is caught and reported as <c>false</c> (never fails the whole call).
    /// </summary>
    private async Task<IReadOnlyDictionary<string, bool>> ProbeStagedAsync(
        Func<ICacheService, Task<bool>> probe,
        string probeName)
    {
        var instances = cacheServices.ToList();
        var tasks = instances
            .Select(dc => ProbeStagedSafelyAsync(dc, probe, probeName))
            .ToList();

        var outcomes = await Task.WhenAll(tasks);

        var results = new Dictionary<string, bool>(outcomes.Length);
        for (var i = 0; i < outcomes.Length; i++)
        {
            results[instances[i].DcId] = outcomes[i];
        }

        return results;
    }

    /// <summary>
    /// Recovery-facing targeted write (E1): stages <paramref name="flag"/> at version
    /// <paramref name="ts"/> into ONE DC's Redis (the <see cref="DcCacheService"/> whose
    /// <see cref="DcCacheService.DcId"/> matches <paramref name="dcId"/>), unlike the broadcast
    /// <see cref="StageFlagAsync"/>. If no DC matches, logs a warning and no-ops. A failing write is
    /// swallowed and logged with the same resilience as <see cref="BroadcastAsync"/>.
    /// </summary>
    public Task<bool> StageFlagToDcAsync(string dcId, FeatureFlag flag, long ts) =>
        TargetedAsync(dcId, s => s.StageFlagAsync(flag, ts), nameof(StageFlagToDcAsync));

    /// <summary>
    /// Recovery-facing targeted write (E1): commits <paramref name="flagId"/> at version
    /// <paramref name="ts"/> into ONE DC's Redis (advancing that DC's committed pointer + index),
    /// unlike the broadcast <see cref="CommitFlagAsync"/>. Only-advance guarded at the underlying
    /// <see cref="ICacheService.CommitFlagAsync"/> implementation (#89): a stale <paramref name="ts"/>
    /// (e.g. from a backfill holding an older snapshot racing a newer normal commit) is a no-op and
    /// never reverts a fresher committed pointer. If no DC matches <paramref name="dcId"/>, logs a
    /// warning and no-ops. A failing write is swallowed and logged with the same resilience
    /// as <see cref="BroadcastAsync"/>.
    /// <para>
    /// #105: returns whether the write was ACCEPTED (advanced the committed pointer) — <c>false</c>
    /// for a no-matching-DC no-op, a swallowed failure, AND a guard-rejected stale write. Callers
    /// (the DC backfiller) must use this to report honest repair counts instead of assuming every
    /// call landed.
    /// </para>
    /// </summary>
    public Task<bool> CommitFlagToDcAsync(string dcId, Guid envId, string flagId, long ts) =>
        TargetedAsync(dcId, s => s.CommitFlagAsync(envId, flagId, ts), nameof(CommitFlagToDcAsync));

    /// <summary>
    /// Recovery-facing targeted write (#58, segment counterpart of <see cref="StageFlagToDcAsync"/>):
    /// stages <paramref name="segment"/> at version <paramref name="ts"/> into ONE DC's Redis (the
    /// <see cref="DcCacheService"/> whose <see cref="DcCacheService.DcId"/> matches
    /// <paramref name="dcId"/>), unlike the broadcast <see cref="StageSegmentAsync"/>. If no DC
    /// matches, logs a warning and no-ops. A failing write is swallowed and logged with the same
    /// resilience as <see cref="BroadcastAsync"/>.
    /// </summary>
    public Task<bool> StageSegmentToDcAsync(string dcId, Segment segment, long ts) =>
        TargetedAsync(dcId, s => s.StageSegmentAsync(segment, ts), nameof(StageSegmentToDcAsync));

    /// <summary>
    /// Recovery-facing targeted write (#58, segment counterpart of <see cref="CommitFlagToDcAsync"/>):
    /// commits <paramref name="segmentId"/> at version <paramref name="ts"/> into ONE DC's Redis
    /// (advancing that DC's committed pointer + per-env index), unlike the broadcast
    /// <see cref="CommitSegmentAsync"/>. Only-advance guarded (#89), mirroring
    /// <see cref="CommitFlagToDcAsync"/>. If no DC matches <paramref name="dcId"/>, logs a warning and
    /// no-ops. A failing write is swallowed and logged with the same resilience as
    /// <see cref="BroadcastAsync"/>.
    /// </summary>
    public Task<bool> CommitSegmentToDcAsync(string dcId, ICollection<Guid> envIds, string segmentId, long ts) =>
        TargetedAsync(dcId, s => s.CommitSegmentAsync(envIds, segmentId, ts), nameof(CommitSegmentToDcAsync));

    /// <summary>
    /// Recovery-facing targeted BestEffort write: upserts <paramref name="flag"/>'s legacy value
    /// key (<c>featbit:flag:{id}</c>) + index into ONE DC's Redis, unlike the broadcast
    /// <see cref="UpsertFlagAsync"/>. Used by the cross-DC reconciler/backfiller to backfill a
    /// returning DC under BestEffort, where the eval-server reads the legacy key (no committed
    /// pointer). Only-advance guarded (#89) via <see cref="ICacheService.UpsertFlagIfNewerAsync"/>:
    /// the backfiller snapshots the source of truth and then awaits per-item writes, so a racing
    /// normal upsert can land a newer value on this DC first — the guard stops the backfill's stale
    /// snapshot from reverting it. If no DC matches <paramref name="dcId"/>, logs a warning and
    /// no-ops; a failing write is swallowed and logged with the same resilience as
    /// <see cref="BroadcastAsync"/>.
    /// <para>
    /// #105: returns whether the write was ACCEPTED (the guard let it land) — <c>false</c> for a
    /// no-matching-DC no-op, a swallowed failure, AND a guard-rejected stale write.
    /// </para>
    /// </summary>
    public Task<bool> UpsertFlagToDcAsync(string dcId, FeatureFlag flag) =>
        TargetedAsync(dcId, s => s.UpsertFlagIfNewerAsync(flag), nameof(UpsertFlagToDcAsync));

    /// <summary>
    /// Segment counterpart of <see cref="UpsertFlagToDcAsync"/>: targeted, only-advance-guarded
    /// (#89) BestEffort upsert of <paramref name="segment"/> (+ per-env index) into ONE DC's Redis
    /// via <see cref="ICacheService.UpsertSegmentIfNewerAsync"/>. If no DC matches
    /// <paramref name="dcId"/>, logs a warning and no-ops. #105: return-value semantics mirror
    /// <see cref="UpsertFlagToDcAsync"/>.
    /// </summary>
    public Task<bool> UpsertSegmentToDcAsync(string dcId, ICollection<Guid> envIds, Segment segment) =>
        TargetedAsync(dcId, s => s.UpsertSegmentIfNewerAsync(envIds, segment), nameof(UpsertSegmentToDcAsync));

    /// <summary>
    /// Recovery-facing targeted write (#91): upserts one secret's cache entry
    /// (<c>featbit:secret:{value}</c>, a hash of descriptor fields) into ONE DC's Redis, unlike the
    /// broadcast <see cref="UpsertSecretAsync"/>. Used by the cross-DC reconciler/backfiller to
    /// backfill a DC whose Redis lost its secret keys — without this, SDK auth (a per-key existence
    /// check with no DB fallback; see <see cref="Domain.Environments.Secret"/>) keeps failing on that
    /// DC even after flags/segments are healed.
    /// <para>
    /// Unlike the flag/segment targeted writes above, this is NOT only-advance guarded: the secret
    /// hash carries no version/timestamp (it is keyed by the secret's own value, not by env+id), so
    /// there is nothing to compare against — <see cref="RedisCacheService.UpsertSecretAsync"/> is
    /// already an unconditional last-write-wins <c>HASH SET</c>, exactly like the existing broadcast
    /// <see cref="UpsertSecretAsync"/>. Applies in BOTH consistency modes (secrets are never
    /// staged/gated).
    /// </para>
    /// If no DC matches <paramref name="dcId"/>, logs a warning and no-ops. A failing write is
    /// swallowed and logged with the same resilience as <see cref="BroadcastAsync"/>.
    /// </summary>
    public Task UpsertSecretToDcAsync(string dcId, ResourceDescriptor resourceDescriptor, Secret secret) =>
        TargetedAsync(dcId, s => s.UpsertSecretAsync(resourceDescriptor, secret), nameof(UpsertSecretToDcAsync));

    private async Task TargetedAsync(string dcId, Func<ICacheService, Task> action, string operationName)
    {
        var dc = cacheServices.FirstOrDefault(c => c.DcId == dcId);
        if (dc == null)
        {
            logger.LogWarning(
                "Targeted cache operation '{Operation}' requested for unknown DC {DcId}; no matching cache instance. No-op.",
                operationName,
                dcId);
            return;
        }

        await ExecuteSafelyAsync(dc, action, operationName);
    }

    /// <summary>
    /// #105: bool-returning counterpart of <see cref="TargetedAsync(string,Func{ICacheService,Task},string)"/>
    /// for the accept-signalling targeted writes (Stage/Commit/UpsertIfNewer). A no-matching-DC
    /// no-op returns <c>false</c> (same as a guard-rejected or swallowed-failure write) — callers
    /// cannot distinguish "no DC configured" from "guard rejected" from this return value alone,
    /// but both are correctly excluded from an "accepted" count either way.
    /// </summary>
    private async Task<bool> TargetedAsync(string dcId, Func<ICacheService, Task<bool>> action, string operationName)
    {
        var dc = cacheServices.FirstOrDefault(c => c.DcId == dcId);
        if (dc == null)
        {
            logger.LogWarning(
                "Targeted cache operation '{Operation}' requested for unknown DC {DcId}; no matching cache instance. No-op.",
                operationName,
                dcId);
            return false;
        }

        return await ExecuteSafelyAsync(dc, action, operationName);
    }

    /// <summary>
    /// #108 item 4: shared per-DC probe execution for <see cref="ProbeStagedAsync"/>, parameterized
    /// by <paramref name="probe"/> (previously duplicated once per resource type as
    /// ProbeStagedSafelyAsync / ProbeStagedSegmentSafelyAsync).
    /// </summary>
    private async Task<bool> ProbeStagedSafelyAsync(DcCacheService dc, Func<ICacheService, Task<bool>> probe, string probeName)
    {
        try
        {
            return await probe(dc.Service);
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (Exception ex)
        {
            logger.LogError(
                ex,
                "{ProbeName} probe failed for DC {DcId} (implementation {CacheService}). Reporting not-staged.",
                probeName,
                dc.DcId,
                dc.Service.GetType().FullName);
            return false;
        }
    }

    private async Task<bool> ExecuteSafelyAsync(
        DcCacheService dc,
        Func<ICacheService, Task> action,
        string operationName)
    {
        try
        {
            await action(dc.Service);
            return true;
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (Exception ex)
        {
            logger.LogError(
                ex,
                "Redis cache broadcast operation '{Operation}' failed for DC {DcId} (implementation {CacheService}). Continuing.",
                operationName,
                dc.DcId,
                dc.Service.GetType().FullName);
            return false;
        }
    }

    /// <summary>
    /// #105: bool-returning counterpart of <see cref="ExecuteSafelyAsync(DcCacheService,Func{ICacheService,Task},string)"/>
    /// for the accept-signalling targeted writes — returns the underlying call's own accept result
    /// instead of a fixed "did not throw" <c>true</c>, and <c>false</c> (not merely swallowed) on a
    /// thrown exception, so a genuine failure is never counted as accepted.
    /// </summary>
    private async Task<bool> ExecuteSafelyAsync(
        DcCacheService dc,
        Func<ICacheService, Task<bool>> action,
        string operationName)
    {
        try
        {
            return await action(dc.Service);
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (Exception ex)
        {
            logger.LogError(
                ex,
                "Redis cache targeted operation '{Operation}' failed for DC {DcId} (implementation {CacheService}).",
                operationName,
                dc.DcId,
                dc.Service.GetType().FullName);
            return false;
        }
    }

    // Heartbeats live ONLY in the local DC's Redis (cacheServices.First()).
    // - UpsertPodHeartbeat writes to the local instance only (this method).
    // - GetAllHealthMessages reads from the local instance only.
    // - DeletePodConnection still broadcasts, because it also clears the pod's
    //   connection keys, and those were broadcast on connect by
    //   UpsertConnectionMadeAsync.
    // Each DC's control plane MUST be configured with its own Redis as
    // Redis:Instances[0] for this contract to hold.
    public Task UpsertPodHeartbeat(HealthMessage healthMessage)
    {
        var local = cacheServices.First();
        return ExecuteSafelyAsync(
            local,
            s => s.UpsertPodHeartbeat(healthMessage),
            nameof(UpsertPodHeartbeat));
    }

    public Task DeletePodConnection(Guid podId) =>
        BroadcastAsync(s => s.DeletePodConnection(podId), nameof(DeletePodConnection));

    public Task<List<HealthMessage>> GetAllHealthMessages()
    {
        var local = cacheServices.First();
        return local.Service.GetAllHealthMessages();
    }
}