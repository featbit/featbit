using System.Net.WebSockets;
using Domain.EndUsers;
using Domain.Shared;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Testing;
using Moq;
using Streaming;
using Streaming.Connections;
using Streaming.Protocol;
using Streaming.Services;

namespace Streaming.UnitTests.Services;

public class AdminServiceTests
{
    private static readonly Guid EnvA = Guid.NewGuid();
    private static readonly Guid EnvB = Guid.NewGuid();

    [Fact]
    public async Task PushFullSync_NoConnections_DoesNothing()
    {
        var sut = CreateSut(out var dataSync, out _);

        await sut.PushFullSyncToAllActiveSdks();

        dataSync.Verify(
            x => x.GetServerSdkPayloadAsync(It.IsAny<Guid>(), It.IsAny<long>()),
            Times.Never);
        dataSync.Verify(
            x => x.GetClientSdkPayloadAsync(It.IsAny<Guid>(), It.IsAny<EndUser>(), It.IsAny<long>()),
            Times.Never);
    }

    [Fact]
    public async Task PushFullSync_ServerOnly_OneEnv_BuildsPayloadOnceAndSendsToAllServers()
    {
        var (s1, ws1) = MakeServerConnection(EnvA);
        var (s2, ws2) = MakeServerConnection(EnvA);
        var (s3, ws3) = MakeServerConnection(EnvA);

        var sut = CreateSut(out var dataSync, out _, s1, s2, s3);
    var serverPayload = new ServerSdkPayload(DataSyncEventTypes.Full, [], []);
        dataSync.Setup(x => x.GetServerSdkPayloadAsync(EnvA, 0)).ReturnsAsync(serverPayload);

        await sut.PushFullSyncToAllActiveSdks();

        dataSync.Verify(x => x.GetServerSdkPayloadAsync(EnvA, 0), Times.Once);
        VerifySentOnce(ws1);
        VerifySentOnce(ws2);
        VerifySentOnce(ws3);
    }

    [Fact]
    public async Task PushFullSync_ClientOnly_OneEnv_BuildsPayloadPerUserAndSendsToEach()
    {
        var alice = new EndUser { KeyId = "alice", Name = "Alice" };
        var bob = new EndUser { KeyId = "bob", Name = "Bob" };
        var (c1, ws1) = MakeClientConnection(EnvA, alice);
        var (c2, ws2) = MakeClientConnection(EnvA, bob);

        var sut = CreateSut(out var dataSync, out _, c1, c2);
        dataSync
            .Setup(x => x.GetClientSdkPayloadAsync(EnvA, alice, 0))
            .ReturnsAsync(new ClientSdkPayload(DataSyncEventTypes.Patch, "alice", []));
        dataSync
            .Setup(x => x.GetClientSdkPayloadAsync(EnvA, bob, 0))
            .ReturnsAsync(new ClientSdkPayload(DataSyncEventTypes.Patch, "bob", []));

        await sut.PushFullSyncToAllActiveSdks();

        dataSync.Verify(x => x.GetClientSdkPayloadAsync(EnvA, alice, 0), Times.Once);
        dataSync.Verify(x => x.GetClientSdkPayloadAsync(EnvA, bob, 0), Times.Once);
        dataSync.Verify(
            x => x.GetServerSdkPayloadAsync(It.IsAny<Guid>(), It.IsAny<long>()),
            Times.Never);
        VerifySentOnce(ws1);
        VerifySentOnce(ws2);
    }

    [Fact]
    public async Task PushFullSync_MixedServerAndClient_SameEnv_BothFlowsExecute()
    {
        var alice = new EndUser { KeyId = "alice", Name = "Alice" };
        var (server, serverWs) = MakeServerConnection(EnvA);
        var (client, clientWs) = MakeClientConnection(EnvA, alice);

        var sut = CreateSut(out var dataSync, out _, server, client);
        dataSync
            .Setup(x => x.GetServerSdkPayloadAsync(EnvA, 0))
            .ReturnsAsync(new ServerSdkPayload(DataSyncEventTypes.Patch, [], []));
        dataSync
            .Setup(x => x.GetClientSdkPayloadAsync(EnvA, alice, 0))
            .ReturnsAsync(new ClientSdkPayload(DataSyncEventTypes.Patch, "alice", []));

        await sut.PushFullSyncToAllActiveSdks();

        VerifySentOnce(serverWs);
        VerifySentOnce(clientWs);
        dataSync.Verify(x => x.GetServerSdkPayloadAsync(EnvA, 0), Times.Once);
        dataSync.Verify(x => x.GetClientSdkPayloadAsync(EnvA, alice, 0), Times.Once);
    }

    [Fact]
    public async Task PushFullSync_ClientWithoutUser_IsSkipped_OthersStillServed()
    {
        var alice = new EndUser { KeyId = "alice", Name = "Alice" };
        var (identified, identifiedWs) = MakeClientConnection(EnvA, alice);
        var (anon, anonWs) = MakeClientConnection(EnvA, user: null);

        var sut = CreateSut(out var dataSync, out _, identified, anon);
        dataSync
            .Setup(x => x.GetClientSdkPayloadAsync(EnvA, alice, 0))
            .ReturnsAsync(new ClientSdkPayload(DataSyncEventTypes.Patch, "alice", []));

        await sut.PushFullSyncToAllActiveSdks();

        VerifySentOnce(identifiedWs);
        VerifyNeverSent(anonWs);
        dataSync.Verify(
            x => x.GetClientSdkPayloadAsync(EnvA, It.IsAny<EndUser>(), 0),
            Times.Once);
    }

    [Fact]
    public async Task PushFullSync_MultipleEnvs_EachBuildsItsOwnServerPayload()
    {
        var (a1, aWs1) = MakeServerConnection(EnvA);
        var (a2, aWs2) = MakeServerConnection(EnvA);
        var (b1, bWs1) = MakeServerConnection(EnvB);

        var sut = CreateSut(out var dataSync, out _, a1, a2, b1);
        dataSync
            .Setup(x => x.GetServerSdkPayloadAsync(EnvA, 0))
            .ReturnsAsync(new ServerSdkPayload(DataSyncEventTypes.Patch, [], []));
        dataSync
            .Setup(x => x.GetServerSdkPayloadAsync(EnvB, 0))
            .ReturnsAsync(new ServerSdkPayload(DataSyncEventTypes.Patch, [], []));

        await sut.PushFullSyncToAllActiveSdks();

        dataSync.Verify(x => x.GetServerSdkPayloadAsync(EnvA, 0), Times.Once);
        dataSync.Verify(x => x.GetServerSdkPayloadAsync(EnvB, 0), Times.Once);
        VerifySentOnce(aWs1);
        VerifySentOnce(aWs2);
        VerifySentOnce(bWs1);
    }

    [Fact]
    public async Task PushFullSync_ServerSendFailure_DoesNotAffectOtherServers()
    {
        var (good1, goodWs1) = MakeServerConnection(EnvA);
        var (bad, badWs) = MakeServerConnection(EnvA, throwsOnSend: true);
        var (good2, goodWs2) = MakeServerConnection(EnvA);

        var sut = CreateSut(out var dataSync, out var logger, good1, bad, good2);
        dataSync
            .Setup(x => x.GetServerSdkPayloadAsync(EnvA, 0))
            .ReturnsAsync(new ServerSdkPayload(DataSyncEventTypes.Patch, [], []));

        await sut.PushFullSyncToAllActiveSdks();

        VerifySentOnce(goodWs1);
        VerifySentOnce(badWs);
        VerifySentOnce(goodWs2);
        Assert.Contains(
            logger.Collector.GetSnapshot(),
            e => e.Level == LogLevel.Error && e.Message.Contains("send failed"));
    }

    [Fact]
    public async Task PushFullSync_ClientSendFailure_DoesNotAffectOtherClients()
    {
        var alice = new EndUser { KeyId = "alice", Name = "Alice" };
        var bob = new EndUser { KeyId = "bob", Name = "Bob" };
        var (good, goodWs) = MakeClientConnection(EnvA, alice);
        var (bad, badWs) = MakeClientConnection(EnvA, bob, throwsOnSend: true);

        var sut = CreateSut(out var dataSync, out var logger, good, bad);
        dataSync
            .Setup(x => x.GetClientSdkPayloadAsync(EnvA, alice, 0))
            .ReturnsAsync(new ClientSdkPayload(DataSyncEventTypes.Patch, "alice", []));
        dataSync
            .Setup(x => x.GetClientSdkPayloadAsync(EnvA, bob, 0))
            .ReturnsAsync(new ClientSdkPayload(DataSyncEventTypes.Patch, "bob", []));

        await sut.PushFullSyncToAllActiveSdks();

        VerifySentOnce(goodWs);
        VerifySentOnce(badWs);
        Assert.Contains(
            logger.Collector.GetSnapshot(),
            e => e.Level == LogLevel.Error && e.Message.Contains("send failed"));
    }

    [Fact]
    public async Task PushFullSync_ClientPayloadBuildFailure_DoesNotAffectOtherClients()
    {
        var alice = new EndUser { KeyId = "alice", Name = "Alice" };
        var bob = new EndUser { KeyId = "bob", Name = "Bob" };
        var (good, goodWs) = MakeClientConnection(EnvA, alice);
        var (bad, badWs) = MakeClientConnection(EnvA, bob);

        var sut = CreateSut(out var dataSync, out var logger, good, bad);
        dataSync
            .Setup(x => x.GetClientSdkPayloadAsync(EnvA, alice, 0))
            .ReturnsAsync(new ClientSdkPayload(DataSyncEventTypes.Patch, "alice", []));
        dataSync
            .Setup(x => x.GetClientSdkPayloadAsync(EnvA, bob, 0))
            .ThrowsAsync(new InvalidOperationException("eval failed for bob"));

        await sut.PushFullSyncToAllActiveSdks();

        VerifySentOnce(goodWs);
        VerifyNeverSent(badWs);
        Assert.Contains(
            logger.Collector.GetSnapshot(),
            e => e.Level == LogLevel.Error);
    }

    [Fact]
    public async Task PushFullSync_ServerPayloadBuildFailure_StillProcessesClientsInSameEnv()
    {
        var alice = new EndUser { KeyId = "alice", Name = "Alice" };
        var (server, serverWs) = MakeServerConnection(EnvA);
        var (client, clientWs) = MakeClientConnection(EnvA, alice);

        var sut = CreateSut(out var dataSync, out var logger, server, client);
        dataSync
            .Setup(x => x.GetServerSdkPayloadAsync(EnvA, 0))
            .ThrowsAsync(new InvalidOperationException("server build failed"));
        dataSync
            .Setup(x => x.GetClientSdkPayloadAsync(EnvA, alice, 0))
            .ReturnsAsync(new ClientSdkPayload(DataSyncEventTypes.Patch, "alice", []));

        await sut.PushFullSyncToAllActiveSdks();

        VerifyNeverSent(serverWs);
        VerifySentOnce(clientWs);
        Assert.Contains(
            logger.Collector.GetSnapshot(),
            e => e.Level == LogLevel.Error && e.Message.Contains("server SDK payload"));
    }

    [Fact]
    public async Task PushFullSync_EnvFailure_DoesNotPreventOtherEnvs()
    {
        var (aServer, aWs) = MakeServerConnection(EnvA);
        var (bServer, bWs) = MakeServerConnection(EnvB);

        var sut = CreateSut(out var dataSync, out var logger, aServer, bServer);
        dataSync
            .Setup(x => x.GetServerSdkPayloadAsync(EnvA, 0))
            .ThrowsAsync(new InvalidOperationException("env A failed"));
        dataSync
            .Setup(x => x.GetServerSdkPayloadAsync(EnvB, 0))
            .ReturnsAsync(new ServerSdkPayload(DataSyncEventTypes.Patch, [], []));

        await sut.PushFullSyncToAllActiveSdks();

        VerifyNeverSent(aWs);
        VerifySentOnce(bWs);
        Assert.Contains(
            logger.Collector.GetSnapshot(),
            e => e.Level == LogLevel.Error);
    }

    [Fact]
    public async Task PushFullSync_ServersInTwoEnvs_DoNotReceiveOtherEnvsPayload()
    {
        // Regression guard: a previous version of this code iterated the outer connections
        // collection rather than the env-scoped subset, which would have sent env A's payload
        // to env B's server SDKs and corrupted their state. Verify each env's WebSocket is
        // hit exactly once.
        var (a1, aWs) = MakeServerConnection(EnvA);
        var (b1, bWs) = MakeServerConnection(EnvB);

        var sut = CreateSut(out var dataSync, out _, a1, b1);
        dataSync
            .Setup(x => x.GetServerSdkPayloadAsync(EnvA, 0))
            .ReturnsAsync(new ServerSdkPayload(DataSyncEventTypes.Patch, [], []));
        dataSync
            .Setup(x => x.GetServerSdkPayloadAsync(EnvB, 0))
            .ReturnsAsync(new ServerSdkPayload(DataSyncEventTypes.Patch, [], []));

        await sut.PushFullSyncToAllActiveSdks();

        VerifySentOnce(aWs);
        VerifySentOnce(bWs);
    }

    [Fact]
    public async Task PushFullSync_RespectsConcurrencyCap()
    {
        const int connectionCount = 20;
        const int cap = 5;

        var observedCurrent = 0;
        var observedMax = 0;
        var lockObj = new object();
        var releaseGate = new TaskCompletionSource();
        var capReached = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);

        // Build `connectionCount` client connections. Sends never block — the gating instead
        // happens inside the data-sync mock so we can observe how many evals are in flight at
        // the same time. The semaphore must keep that number at or below `cap`.
        var connections = new List<Connection>();
        var sockets = new List<Mock<WebSocket>>();
        var users = new List<EndUser>();
        for (var i = 0; i < connectionCount; i++)
        {
            var user = new EndUser { KeyId = $"u{i}", Name = $"u{i}" };
            users.Add(user);
            var (conn, ws) = MakeClientConnection(EnvA, user);
            connections.Add(conn);
            sockets.Add(ws);
        }

        var sut = CreateSut(out var dataSync, out _, maxConcurrency: cap, connections.ToArray());

        // Each evaluation: bump the counter, wait for the test to release, then return.
        // Setting one parameterised matcher covers all users.
        dataSync
            .Setup(x => x.GetClientSdkPayloadAsync(EnvA, It.IsAny<EndUser>(), 0))
            .Returns(async (Guid envId, EndUser user, long ts) =>
            {
                int now;
                lock (lockObj)
                {
                    observedCurrent++;
                    now = observedCurrent;
                    if (now > observedMax) observedMax = now;
                    if (now >= cap) capReached.TrySetResult();
                }

                await releaseGate.Task;

                lock (lockObj)
                {
                    observedCurrent--;
                }

                return new ClientSdkPayload(DataSyncEventTypes.Patch, user.KeyId, []);
            });

        var pushTask = sut.PushFullSyncToAllActiveSdks();

        // Wait until the in-flight count saturates the cap (or fail fast after a deadline).
        var reachedCap = await WaitForSignalAsync(capReached.Task, TimeSpan.FromSeconds(5));

        // Snapshot before releasing so the assertion isn't racing with the drain.
        int sawAtSaturation;
        lock (lockObj) sawAtSaturation = observedCurrent;

        releaseGate.SetResult();
        await pushTask;

        Assert.True(reachedCap, $"Timed out waiting for {cap} concurrent evaluations");
        Assert.True(
            sawAtSaturation == cap,
            $"Expected exactly {cap} concurrent evaluations at saturation, observed {sawAtSaturation}");
        Assert.True(
            observedMax <= cap,
            $"Max concurrent evaluations {observedMax} exceeded the cap {cap}");
        // Sanity check: all connections were eventually processed.
        foreach (var ws in sockets)
        {
            VerifySentOnce(ws);
        }
    }

    [Fact]
    public async Task PushFullSync_ConcurrencyCapAppliesAcrossMultiEnvPush()
    {
        // Envs are processed sequentially today (one PushEnvFullSyncAsync awaited at a time),
        // so this test proves the weaker (but still important) property: the cap is honored
        // when there is work across multiple envs in a single push. It does NOT prove the
        // semaphore is shared across envs — that's proven separately by
        // PushFullSync_OnlyOneSemaphoreIsCreatedPerPush.
        const int perEnv = 10;
        const int cap = 4;

        var observedCurrent = 0;
        var observedMax = 0;
        var lockObj = new object();
        var releaseGate = new TaskCompletionSource();
        var capReached = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);

        var connections = new List<Connection>();
        var sockets = new List<Mock<WebSocket>>();

        for (var i = 0; i < perEnv; i++)
        {
            var user = new EndUser { KeyId = $"a{i}", Name = $"a{i}" };
            var (conn, ws) = MakeClientConnection(EnvA, user);
            connections.Add(conn);
            sockets.Add(ws);
        }
        for (var i = 0; i < perEnv; i++)
        {
            var user = new EndUser { KeyId = $"b{i}", Name = $"b{i}" };
            var (conn, ws) = MakeClientConnection(EnvB, user);
            connections.Add(conn);
            sockets.Add(ws);
        }

        var sut = CreateSut(out var dataSync, out _, maxConcurrency: cap, connections.ToArray());

        dataSync
            .Setup(x => x.GetClientSdkPayloadAsync(It.IsAny<Guid>(), It.IsAny<EndUser>(), 0))
            .Returns(async (Guid envId, EndUser user, long ts) =>
            {
                int now;
                lock (lockObj)
                {
                    observedCurrent++;
                    now = observedCurrent;
                    if (now > observedMax) observedMax = now;
                    if (now >= cap) capReached.TrySetResult();
                }

                await releaseGate.Task;

                lock (lockObj) observedCurrent--;
                return new ClientSdkPayload(DataSyncEventTypes.Patch, user.KeyId, []);
            });

        var pushTask = sut.PushFullSyncToAllActiveSdks();

        var reachedCap = await WaitForSignalAsync(capReached.Task, TimeSpan.FromSeconds(5));

        releaseGate.SetResult();
        await pushTask;

        Assert.True(reachedCap, $"Timed out waiting for {cap} concurrent evaluations");
        Assert.True(
            observedMax <= cap,
            $"Max concurrent evaluations {observedMax} exceeded the cap {cap}");
        Assert.True(
            observedMax == cap,
            $"Expected to reach the cap {cap}, only reached {observedMax}");
        // All connections in both envs were processed.
        foreach (var ws in sockets)
        {
            VerifySentOnce(ws);
        }
    }

    // ---------- helpers ----------

    private static AdminService CreateSut(
        out Mock<IDataSyncService> dataSync,
        out FakeLogger<AdminService> logger,
        params Connection[] connections)
        => CreateSut(out dataSync, out logger, maxConcurrency: 50, connections);

    private static AdminService CreateSut(
        out Mock<IDataSyncService> dataSync,
        out FakeLogger<AdminService> logger,
        int maxConcurrency,
        params Connection[] connections)
    {
        var manager = new Mock<IConnectionManager>();
        manager.Setup(x => x.GetAllConnections()).Returns(connections);

        dataSync = new Mock<IDataSyncService>();
        logger = new FakeLogger<AdminService>();
        var options = new StreamingOptions { PushFullSyncMaxConcurrency = maxConcurrency };
        return new AdminService(manager.Object, dataSync.Object, options, logger);
    }

    private static (Connection conn, Mock<WebSocket> ws) MakeServerConnection(
        Guid envId, bool throwsOnSend = false)
    {
        var secret = new Secret(SecretTypes.Server, "p", envId, "e");
        return MakeConnection(secret, user: null, throwsOnSend);
    }

    private static (Connection conn, Mock<WebSocket> ws) MakeClientConnection(
        Guid envId, EndUser? user, bool throwsOnSend = false)
    {
        var secret = new Secret(SecretTypes.Client, "p", envId, "e");
        return MakeConnection(secret, user, throwsOnSend);
    }

    private static (Connection conn, Mock<WebSocket> ws) MakeConnection(
        Secret secret, EndUser? user, bool throwsOnSend = false)
    {
        var ws = new Mock<WebSocket>();
        ws.SetupGet(x => x.State).Returns(WebSocketState.Open);

        var send = ws.Setup(x => x.SendAsync(
            It.IsAny<ArraySegment<byte>>(),
            It.IsAny<WebSocketMessageType>(),
            It.IsAny<bool>(),
            It.IsAny<CancellationToken>()));

        if (throwsOnSend)
        {
            send.ThrowsAsync(new InvalidOperationException("send failed"));
        }
        else
        {
            send.Returns(Task.CompletedTask);
        }

        var conn = new Connection(ws.Object, secret);
        if (user != null)
        {
            conn.AttachUser(user);
        }
        return (conn, ws);
    }

    private static void VerifySentOnce(Mock<WebSocket> ws) =>
        ws.Verify(
            x => x.SendAsync(
                It.IsAny<ArraySegment<byte>>(),
                WebSocketMessageType.Text,
                true,
                It.IsAny<CancellationToken>()),
            Times.Once);

    private static void VerifyNeverSent(Mock<WebSocket> ws) =>
        ws.Verify(
            x => x.SendAsync(
                It.IsAny<ArraySegment<byte>>(),
                It.IsAny<WebSocketMessageType>(),
                It.IsAny<bool>(),
                It.IsAny<CancellationToken>()),
            Times.Never);

    private static async Task<bool> WaitForSignalAsync(Task task, TimeSpan timeout)
    {
        try
        {
            await task.WaitAsync(timeout);
            return true;
        }
        catch (TimeoutException)
        {
            return false;
        }
    }
}
