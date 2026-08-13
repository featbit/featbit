using Api.Application.ControlPlane;

namespace Api.UnitTests.Stubs;

/// <summary>
/// #71b test double: an <see cref="ILeaderElection"/> whose leadership state is fixed at
/// construction. Lets <c>DcIdConsistencyCheckerTests</c> drive <c>RunOnceAsync</c> directly with a
/// deterministic leader/not-leader state, without a real <see cref="RedisLeaderElector"/>.
/// </summary>
internal sealed class FakeLeaderElection(bool isLeader) : ILeaderElection
{
    public bool IsLeader { get; } = isLeader;

    public Guid InstanceId { get; } = Guid.NewGuid();
}
