using Api.Application.ControlPlane;
using Api.Infrastructure.Caches;
using Infrastructure.Caches.Redis;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using Moq;
using StackExchange.Redis;

namespace Api.UnitTests.Application.ControlPlane;

/// <summary>
/// Tests for <see cref="ControlPlaneDiagnosticHealthCheck"/>.
/// </summary>
/// <remarks>
/// The severity split is the whole design: a peer DC going away is Degraded, because the control
/// plane is built to keep serving through it, but the LOCAL DC going away is Unhealthy, because
/// every commit this replica reports is then a lie. A test suite that only checked "returns
/// non-healthy" would let those two collapse.
/// </remarks>
public class ControlPlaneDiagnosticHealthCheckTests
{
    private static readonly HealthCheckContext Context = new()
    {
        Registration = new HealthCheckRegistration(
            "control-plane-diagnostics",
            _ => new Mock<IHealthCheck>().Object,
            HealthStatus.Unhealthy,
            ["Diagnostics"])
    };

    private static DcRedisConnection Dc(string dcId, bool connected, bool isLocal = false)
    {
        var mux = new Mock<IConnectionMultiplexer>();
        mux.SetupGet(m => m.IsConnected).Returns(connected);

        var client = new Mock<IRedisClient>();
        client.SetupGet(c => c.Connection).Returns(mux.Object);

        return new DcRedisConnection(dcId, client.Object, isLocal);
    }

    private static DcRedisConnection UnreadableDc(string dcId, bool isLocal = false)
    {
        var client = new Mock<IRedisClient>();
        client.SetupGet(c => c.Connection).Throws(new RedisConnectionException(
            ConnectionFailureType.UnableToConnect, "cannot read connection state"));

        return new DcRedisConnection(dcId, client.Object, isLocal);
    }

    private static ControlPlaneDiagnosticHealthCheck CreateSut(
        IReadOnlyList<DcRedisConnection>? dcs = null,
        ILeaderElection? leaderElection = null)
    {
        var services = new ServiceCollection();

        if (dcs is not null)
        {
            services.AddSingleton(dcs);
        }

        if (leaderElection is not null)
        {
            services.AddSingleton(leaderElection);
        }

        return new ControlPlaneDiagnosticHealthCheck(services.BuildServiceProvider());
    }

    [Fact]
    public async Task CheckHealthAsync_WithNoDependenciesRegistered_IsHealthy()
    {
        var sut = CreateSut();

        var result = await sut.CheckHealthAsync(Context);

        // Neither dependency is guaranteed to exist: per-DC connections only exist on the Redis
        // cache path and leader election is opt-in. A missing optional dependency is a supported
        // configuration, not a fault.
        Assert.Equal(HealthStatus.Healthy, result.Status);
        Assert.Equal(0, result.Data["dc_count"]);
    }

    [Fact]
    public async Task CheckHealthAsync_WithAnEmptyDcList_IsHealthy()
    {
        var sut = CreateSut(Array.Empty<DcRedisConnection>());

        var result = await sut.CheckHealthAsync(Context);

        Assert.Equal(HealthStatus.Healthy, result.Status);
        Assert.Equal(0, result.Data["dc_count"]);
    }

    [Fact]
    public async Task CheckHealthAsync_WithAllDcsConnected_IsHealthy()
    {
        var sut = CreateSut([Dc("west", true, isLocal: true), Dc("east", true)]);

        var result = await sut.CheckHealthAsync(Context);

        Assert.Equal(HealthStatus.Healthy, result.Status);
        Assert.Equal(2, result.Data["dc_count"]);
        Assert.Equal(0, result.Data["unreachable_dc_count"]);
        Assert.Equal(true, result.Data["dc.west.connected"]);
        Assert.Equal(true, result.Data["dc.east.connected"]);
        Assert.Equal(true, result.Data["dc.west.is_local"]);
        Assert.Equal(false, result.Data["dc.east.is_local"]);
    }

    [Fact]
    public async Task CheckHealthAsync_WithAnUnreachablePeerDc_IsDegradedNotUnhealthy()
    {
        var sut = CreateSut([Dc("west", true, isLocal: true), Dc("east", false)]);

        var result = await sut.CheckHealthAsync(Context);

        // Failing hard on a peer outage would escalate a single-DC problem into a control-plane
        // outage — precisely the failure the swallow-and-continue cache design exists to avoid.
        Assert.Equal(HealthStatus.Degraded, result.Status);
        Assert.Equal(1, result.Data["unreachable_dc_count"]);
        Assert.Contains("east", result.Description);
    }

    [Fact]
    public async Task CheckHealthAsync_WithAnUnreachableLocalDc_IsUnhealthy()
    {
        var sut = CreateSut([Dc("west", false, isLocal: true), Dc("east", true)]);

        var result = await sut.CheckHealthAsync(Context);

        Assert.Equal(HealthStatus.Unhealthy, result.Status);
        Assert.Contains("LOCAL", result.Description);
    }

    [Fact]
    public async Task CheckHealthAsync_WithBothLocalAndPeerUnreachable_IsUnhealthy()
    {
        var sut = CreateSut([Dc("west", false, isLocal: true), Dc("east", false)]);

        var result = await sut.CheckHealthAsync(Context);

        Assert.Equal(HealthStatus.Unhealthy, result.Status);
        Assert.Equal(2, result.Data["unreachable_dc_count"]);
    }

    [Fact]
    public async Task CheckHealthAsync_WithAnUnreadableConnectionState_CountsItUnreachableAndReportsTheExceptionTypeOnly()
    {
        var sut = CreateSut([Dc("west", true, isLocal: true), UnreadableDc("east")]);

        var result = await sut.CheckHealthAsync(Context);

        Assert.Equal(HealthStatus.Degraded, result.Status);
        Assert.Equal(false, result.Data["dc.east.connected"]);

        // The type name, never the message: driver exception text routinely embeds connection
        // strings and credentials, and this payload is served over HTTP.
        Assert.Equal(nameof(RedisConnectionException), result.Data["dc.east.error"]);
        Assert.DoesNotContain(
            result.Data.Values.OfType<string>(),
            value => value.Contains("cannot read connection state", StringComparison.Ordinal));
    }

    [Fact]
    public async Task CheckHealthAsync_WithAnUnreadableLocalConnectionState_IsUnhealthy()
    {
        var sut = CreateSut([UnreadableDc("west", isLocal: true)]);

        var result = await sut.CheckHealthAsync(Context);

        // A local DC whose state cannot even be read is strictly worse than one reporting
        // disconnected, so it must not be treated as unknown-and-therefore-fine.
        Assert.Equal(HealthStatus.Unhealthy, result.Status);
    }

    [Fact]
    public async Task CheckHealthAsync_WhenLeaderElectionIsRegistered_ReportsTheLeaderState()
    {
        var instanceId = Guid.NewGuid();
        var election = new Mock<ILeaderElection>();
        election.SetupGet(e => e.IsLeader).Returns(true);
        election.SetupGet(e => e.InstanceId).Returns(instanceId);

        var sut = CreateSut([Dc("west", true, isLocal: true)], election.Object);

        var result = await sut.CheckHealthAsync(Context);

        Assert.Equal(true, result.Data["is_leader"]);
        Assert.Equal(instanceId.ToString(), result.Data["instance_id"]);
    }

    [Fact]
    public async Task CheckHealthAsync_WhenLeaderElectionIsNotRegistered_OmitsTheLeaderState()
    {
        var sut = CreateSut([Dc("west", true, isLocal: true)]);

        var result = await sut.CheckHealthAsync(Context);

        Assert.DoesNotContain("is_leader", result.Data.Keys);
    }

    [Fact]
    public async Task CheckHealthAsync_WithNoDcsConfigured_StillReportsTheLeaderState()
    {
        var election = new Mock<ILeaderElection>();
        election.SetupGet(e => e.IsLeader).Returns(false);
        election.SetupGet(e => e.InstanceId).Returns(Guid.Empty);

        var sut = CreateSut(leaderElection: election.Object);

        var result = await sut.CheckHealthAsync(Context);

        // The DC short-circuit returns early; leader state must still make it into the payload,
        // because "who is leader?" is the first question asked when workers stop running.
        Assert.Equal(HealthStatus.Healthy, result.Status);
        Assert.Equal(false, result.Data["is_leader"]);
    }

    [Fact]
    public async Task CheckHealthAsync_ForAnyDc_ReadsOnlyTheLiveConnectionFlag()
    {
        var mux = new Mock<IConnectionMultiplexer>(MockBehavior.Strict);
        mux.SetupGet(m => m.IsConnected).Returns(true);

        var client = new Mock<IRedisClient>(MockBehavior.Strict);
        client.SetupGet(c => c.Connection).Returns(mux.Object);

        var sut = CreateSut([new DcRedisConnection("west", client.Object, true)]);

        var result = await sut.CheckHealthAsync(Context);

        // Strict mocks: any call other than the two set up above throws. This pins the "performs no
        // I/O" contract — a diagnostic endpoint that issues Redis commands can itself become the
        // reason the service is slow.
        Assert.Equal(HealthStatus.Healthy, result.Status);
        mux.VerifyAll();
    }
}
