namespace Api.Application.ControlPlane;

/// <summary>
/// #71a (sub-issue of #71): exposes the current control-plane instance's leadership status. The
/// gated-commit consistency workers (<see cref="CommitCoordinatorWorker"/>, <see cref="RecoveryWorker"/>,
/// <see cref="DcIdConsistencyChecker"/> — gated in #71b) consult <see cref="IsLeader"/> so that, when
/// leader election is enabled, exactly one replica runs those loops at a time; when disabled
/// (default — see <c>ControlPlane:LeaderElection:Enabled</c>) every instance runs — safe
/// (idempotent/version guards) but redundant under multiple replicas. Backed by
/// <see cref="RedisLeaderElector"/> when enabled, or <see cref="AlwaysLeaderElection"/> when
/// disabled.
/// </summary>
public interface ILeaderElection
{
    /// <summary>
    /// True if this control-plane instance currently holds the leader lock. Cheap to read (backed by
    /// a volatile field) — safe to check on every tick of a gated worker.
    /// </summary>
    bool IsLeader { get; }

    /// <summary>
    /// A per-process identifier minted once at startup, used as the lock's value so a stale/foreign
    /// lock (e.g. from a crashed instance whose TTL has not yet expired) is never mistaken for one
    /// this instance holds.
    /// </summary>
    Guid InstanceId { get; }
}
