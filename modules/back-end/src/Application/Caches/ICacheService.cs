using Domain.Environments;
using Domain.Segments;
using Domain.FeatureFlags;
using Domain.Workspaces;
using Domain.Connections;
using Domain.ControlPlane;

namespace Application.Caches;

public interface ICacheService
{
    Task UpsertFlagAsync(FeatureFlag flag);

    /// <summary>
    /// Only-advance targeted upsert (#89): behaves like <see cref="UpsertFlagAsync"/> but guarded by
    /// the env flag index score (the UpdatedAt-unix-ms version register every normal upsert/commit
    /// already maintains), so a write for a stale/older flag value can never revert a fresher one.
    /// Intended ONLY for the backfiller's targeted per-DC writes (a returning/lagging DC's Redis can
    /// race a concurrent normal write); the normal broadcast <see cref="UpsertFlagAsync"/> is left
    /// unconditional.
    /// <para>
    /// #105: returns <c>true</c> iff the write was ACCEPTED by the only-advance guard (i.e. it
    /// actually landed), <c>false</c> if a fresher/equal value already at this key rejected it.
    /// Callers that need an honest "did this write take effect" signal (e.g. the DC backfiller)
    /// must observe this return value instead of assuming every call succeeded.
    /// </para>
    /// </summary>
    Task<bool> UpsertFlagIfNewerAsync(FeatureFlag flag);

    /// <summary>
    /// Stages a new flag version (B1 stage/commit storage) without moving the committed
    /// pointer or touching the env flag index, so the previously committed value stays
    /// readable until <see cref="CommitFlagAsync"/> is called.
    /// <para>
    /// #105: returns <c>true</c> on a successful write. Staging is unconditional (nothing to guard
    /// against a version register here), so this is <c>true</c> in practice unless the underlying
    /// write throws.
    /// </para>
    /// </summary>
    Task<bool> StageFlagAsync(FeatureFlag flag, long ts);

    /// <summary>
    /// Commits a previously staged flag version (B1 stage/commit storage): moves the
    /// committed pointer and advances the env flag index to <paramref name="ts"/>.
    /// <para>
    /// #105: returns <c>true</c> iff the committed pointer actually ADVANCED (the only-advance
    /// guard accepted <paramref name="ts"/>), <c>false</c> if an equal/fresher version was already
    /// committed and this call was a guard-rejected no-op.
    /// </para>
    /// </summary>
    Task<bool> CommitFlagAsync(Guid envId, string flagId, long ts);

    /// <summary>
    /// Probes whether THIS cache holds the staged version key <c>flag:{id}:v{ts}</c>
    /// (written by <see cref="StageFlagAsync"/>). Used by the commit coordinator to
    /// confirm a staged version is present in a given DC's Redis before committing.
    /// </summary>
    Task<bool> HasStagedFlagAsync(Guid id, long ts);

    Task DeleteFlagAsync(Guid envId, Guid flagId);

    Task UpsertSegmentAsync(ICollection<Guid> envIds, Segment segment);

    /// <summary>
    /// Only-advance targeted upsert (#89, segment counterpart of <see cref="UpsertFlagIfNewerAsync"/>):
    /// behaves like <see cref="UpsertSegmentAsync"/> but guarded by a segment index score as the
    /// version register, so a write for a stale/older segment value can never revert a fresher one.
    /// Intended ONLY for the backfiller's targeted per-DC writes; the normal broadcast
    /// <see cref="UpsertSegmentAsync"/> is left unconditional.
    /// <para>
    /// #105: returns <c>true</c> iff the write was ACCEPTED by the only-advance guard, mirroring
    /// <see cref="UpsertFlagIfNewerAsync"/>.
    /// </para>
    /// </summary>
    Task<bool> UpsertSegmentIfNewerAsync(ICollection<Guid> envIds, Segment segment);

    /// <summary>
    /// Stages a new segment version (B2 stage/commit storage) without moving the committed
    /// pointer or touching any env segment index, so the previously committed value stays
    /// readable until <see cref="CommitSegmentAsync"/> is called. Mirrors <see cref="StageFlagAsync"/>,
    /// including its #105 return-value semantics.
    /// </summary>
    Task<bool> StageSegmentAsync(Segment segment, long ts);

    /// <summary>
    /// Commits a previously staged segment version (B2 stage/commit storage): moves the
    /// committed pointer and advances the segment index to <paramref name="ts"/> for each env
    /// in <paramref name="envIds"/> (segments can belong to multiple envs). Mirrors
    /// <see cref="CommitFlagAsync"/>, including its #105 return-value semantics (accepted iff the
    /// committed pointer advanced).
    /// </summary>
    Task<bool> CommitSegmentAsync(ICollection<Guid> envIds, string segmentId, long ts);

    /// <summary>
    /// Probes whether THIS cache holds the staged version key <c>segment:{id}:v{ts}</c>
    /// (written by <see cref="StageSegmentAsync"/>). Used by the commit coordinator to
    /// confirm a staged version is present in a given DC's Redis before committing.
    /// Mirrors <see cref="HasStagedFlagAsync"/>.
    /// </summary>
    Task<bool> HasStagedSegmentAsync(Guid id, long ts);

    Task DeleteSegmentAsync(ICollection<Guid> envIds, Guid segmentId);

    Task UpsertLicenseAsync(Workspace workspace);

    Task UpsertSecretAsync(ResourceDescriptor resourceDescriptor, Secret secret);

    Task DeleteSecretAsync(Secret secret);

    Task<string> GetOrSetLicenseAsync(Guid workspaceId, Func<Task<string>> licenseGetter);

    Task UpsertConnectionMadeAsync(ConnectionMessage connectionInfo);

    Task DeleteConnectionMadeAsync(ConnectionMessage connectionInfo);

    Task UpsertPodHeartbeat(HealthMessage healthMessage);

    Task DeletePodConnection(Guid podId);

    Task<List<HealthMessage>> GetAllHealthMessages();
}