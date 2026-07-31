using Application.Bases.Models;
using Application.Segments;
using Domain.AuditLogs;
using Domain.Segments;

namespace Application.Services;

public interface ISegmentService : IService<Segment>
{
    Task<PagedResult<Segment>> GetListAsync(Guid workspaceId, string rn, SegmentFilter filter);

    Task<ICollection<Segment>> GetListAsync(Guid workspaceId, string rn, bool includeArchived = false);

    Task<ICollection<FlagReference>> GetFlagReferencesAsync(Guid envId, Guid id);

    ValueTask<ICollection<Guid>> GetEnvironmentIdsAsync(Segment segment);

    Task<bool> IsKeyUsedAsync(Guid workspaceId, string type, Guid envId, string key);

    Task<ICollection<string>> GetAllTagsAsync(Guid envId);

    Task<ICollection<SegmentCache>> GetCachesAsync();

    /// <summary>
    /// Authoritative read: returns the COMMITTED segment value, never a pending
    /// (staged-but-not-committed) change. The returned segment has its <c>Pending</c>
    /// slot cleared so callers cannot accidentally serve staged data. Keyed by segment
    /// <paramref name="id"/> since a segment is a single entity (possibly shared across envs).
    /// </summary>
    Task<Segment> GetCommittedAsync(Guid id);

    /// <summary>
    /// Stage <paramref name="pendingValue"/> as a pending change on the segment identified by
    /// <paramref name="id"/>. The committed value is left untouched, so
    /// <see cref="GetCommittedAsync"/> still returns the old value.
    /// <para>
    /// Monotonicity guard (#34): the stage is applied ONLY when <paramref name="version"/> is
    /// strictly greater than both the already-staged pending version (if any) and the committed
    /// version; otherwise it is a no-op. This prevents an out-of-order/stale stage from clobbering
    /// a newer pending change (which the coordinator could then commit).
    /// </para>
    /// <para>
    /// <paramref name="operatorId"/>, <paramref name="operation"/> and
    /// <paramref name="isTargetingChange"/> are the attribution context of the original change
    /// notification (#73), persisted alongside the pending value so the coordinator can later
    /// reconstruct the notification with the real operator instead of inventing one at commit time.
    /// </para>
    /// </summary>
    Task SetPendingAsync(
        Guid id,
        Segment pendingValue,
        long version,
        Guid operatorId = default,
        string operation = Operations.Update,
        bool isTargetingChange = true);

    /// <summary>
    /// Optimistically promote the staged pending change to committed for the segment identified by
    /// <paramref name="id"/>, so <see cref="GetCommittedAsync"/> returns the new value. The
    /// promotion happens ONLY if the stored <see cref="PendingSegmentChange.Version"/> still equals
    /// <paramref name="expectedVersion"/>; otherwise it is a no-op. This version guard prevents a
    /// lost update when a racing <see cref="SetPendingAsync"/> replaces the pending change between
    /// the coordinator reading it and committing it (#33), and lets the coordinator skip stale
    /// promotions (#34).
    /// </summary>
    /// <returns><c>true</c> if the pending change was promoted; <c>false</c> if there was no
    /// pending change or its version no longer matched <paramref name="expectedVersion"/>.</returns>
    Task<bool> PromotePendingAsync(Guid id, long expectedVersion);

    /// <summary>
    /// Enumerate every segment that currently has a staged-but-not-committed change, i.e.
    /// <see cref="Segment.Pending"/> is not null. Used by the commit coordinator to discover
    /// the set of pending changes it must reconcile.
    /// </summary>
    Task<IReadOnlyList<Segment>> GetPendingAsync();

    /// <summary>
    /// Enumerate the COMMITTED value of every segment. Each returned segment has its <c>Pending</c>
    /// slot cleared (mirroring <see cref="GetCommittedAsync"/>) so callers never see staged data.
    /// Used by the returning-DC recovery worker to backfill a DC's Redis with the authoritative
    /// committed state of all segments.
    /// </summary>
    Task<IReadOnlyList<Segment>> GetAllCommittedAsync();
}