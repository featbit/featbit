using Api.Application.ControlPlane;

namespace Api.IntegrationTests.Stubs;

/// <summary>
/// #71b test double: an <see cref="ILeaderElection"/> whose leadership state is fixed at
/// construction. Lets the gated-commit worker tests (<c>CommitCoordinatorWorkerTests</c>,
/// <c>SegmentCommitCoordinatorWorkerTests</c>, <c>RecoveryWorkerTests</c>,
/// <c>ConsistencyMetricsTests</c>) drive <c>RunOnceAsync</c> directly with a deterministic
/// leader/not-leader state, without spinning up a real <see cref="RedisLeaderElector"/>.
/// </summary>
internal sealed class FakeLeaderElection(bool isLeader) : ILeaderElection
{
    public bool IsLeader { get; } = isLeader;

    public Guid InstanceId { get; } = Guid.NewGuid();
}
