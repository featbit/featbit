using Application.Bases.Models;
using Application.FeatureFlags;
using Domain.FeatureFlags;
using Domain.Segments;

namespace Application.Services;

public interface IFeatureFlagService : IService<FeatureFlag>
{
    Task<PagedResult<FeatureFlag>> GetListAsync(Guid envId, FeatureFlagFilter filter);

    Task<FeatureFlag> GetAsync(Guid envId, string key);

    Task<bool> HasKeyBeenUsedAsync(Guid envId, string key);

    Task<ICollection<string>> GetAllTagsAsync(Guid envId);

    Task<ICollection<Segment>> GetRelatedSegmentsAsync(ICollection<FeatureFlag> flags);

    Task MarkAsUpdatedAsync(ICollection<Guid> flagIds, Guid operatorId);

    /// <summary>
    /// Authoritative read: returns the COMMITTED flag value, never a pending
    /// (staged-but-not-committed) change. The returned flag has its <c>Pending</c>
    /// slot cleared so callers cannot accidentally serve staged data.
    /// </summary>
    Task<FeatureFlag> GetCommittedAsync(Guid envId, string key);

    /// <summary>
    /// Stage <paramref name="pendingValue"/> as a pending change on the flag identified
    /// by <paramref name="envId"/>/<paramref name="key"/>. The committed value is left
    /// untouched, so <see cref="GetCommittedAsync"/> still returns the old value.
    /// <para>
    /// Monotonicity guard (#34): the stage is applied ONLY when <paramref name="version"/> is
    /// strictly greater than both the already-staged pending version (if any) and the committed
    /// version; otherwise it is a no-op. This prevents an out-of-order/stale stage from clobbering
    /// a newer pending change (which the coordinator could then commit).
    /// </para>
    /// </summary>
    Task SetPendingAsync(Guid envId, string key, FeatureFlag pendingValue, long version);

    /// <summary>
    /// Optimistically promote the staged pending change to committed for the flag identified by
    /// <paramref name="envId"/>/<paramref name="key"/>, so <see cref="GetCommittedAsync"/>
    /// returns the new value. The promotion happens ONLY if the stored
    /// <see cref="PendingFlagChange.Version"/> still equals <paramref name="expectedVersion"/>;
    /// otherwise it is a no-op. This version guard prevents a lost update when a racing
    /// <see cref="SetPendingAsync"/> replaces the pending change between the coordinator reading it
    /// and committing it (#33), and lets the coordinator skip stale promotions (#34).
    /// </summary>
    /// <returns><c>true</c> if the pending change was promoted; <c>false</c> if there was no
    /// pending change or its version no longer matched <paramref name="expectedVersion"/>.</returns>
    Task<bool> PromotePendingAsync(Guid envId, string key, long expectedVersion);

    /// <summary>
    /// Enumerate every flag (across all envs) that currently has a staged-but-not-committed
    /// change, i.e. <see cref="FeatureFlag.Pending"/> is not null. Used by the commit
    /// coordinator to discover the set of pending changes it must reconcile.
    /// </summary>
    Task<IReadOnlyList<FeatureFlag>> GetPendingAsync();

    /// <summary>
    /// Enumerate the COMMITTED value of every flag (across all envs). Each returned flag has its
    /// <c>Pending</c> slot cleared (mirroring <see cref="GetCommittedAsync"/>) so callers never see
    /// staged data. Used by the returning-DC recovery worker to backfill a DC's Redis with the
    /// authoritative committed state of all flags.
    /// </summary>
    Task<IReadOnlyList<FeatureFlag>> GetAllCommittedAsync();
}