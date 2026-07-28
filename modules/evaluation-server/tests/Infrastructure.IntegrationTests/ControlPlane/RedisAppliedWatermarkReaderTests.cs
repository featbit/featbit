using System.Net.WebSockets;
using Domain.Shared;
using Infrastructure.Caches.Redis;
using Infrastructure.IntegrationTests.Fixtures;
using Moq;
using StackExchange.Redis;
using Streaming.Connections;
using Streaming.ControlPlane;

namespace Infrastructure.IntegrationTests.ControlPlane;

/// <summary>
/// Issue #46 integration tests: <see cref="RedisAppliedWatermarkReader"/> derives the per-env
/// applied watermark from the local DC Redis flag index (max committed score), so the value is
/// independent of any per-pod in-memory stream-processing state. This is the cold-start fix:
/// a fresh reader with no prior consumption still reports the DC's committed serving state.
/// Uses the shared Redis Testcontainer and flushes Redis before each test.
/// </summary>
[Collection(RedisCollection.Name)]
public class RedisAppliedWatermarkReaderTests : IntegrationTestBase, IAsyncLifetime
{
    private readonly RedisFixture _fixture;
    private ConnectionMultiplexer _connection = null!;
    private IDatabase _db = null!;
    private IRedisClient _redisClient = null!;

    public RedisAppliedWatermarkReaderTests(RedisFixture fixture)
    {
        _fixture = fixture;
    }

    public async Task InitializeAsync()
    {
        if (!DockerAvailability.IsAvailable)
        {
            return;
        }

        var options = ConfigurationOptions.Parse(_fixture.ConnectionString);
        options.AllowAdmin = true;
        _connection = await ConnectionMultiplexer.ConnectAsync(options);

        var server = _connection.GetServer(_connection.GetEndPoints().Single());
        await server.FlushDatabaseAsync();

        _db = _connection.GetDatabase();
        var clientMock = new Mock<IRedisClient>();
        clientMock.Setup(x => x.Connection).Returns(_connection);
        clientMock.Setup(x => x.GetDatabase()).Returns(_db);
        clientMock.Setup(x => x.IsHealthyAsync()).ReturnsAsync(true);
        _redisClient = clientMock.Object;
    }

    /// <summary>Connection manager that exposes a fixed set of envs via active connections.</summary>
    private sealed class FakeConnectionManager(params Guid[] envIds) : IConnectionManager
    {
        private readonly List<Connection> _connections = envIds
            .Select(e => new Connection(new ClientWebSocket(), new Secret("client", "proj", e, "env")))
            .ToList();

        public Task Add(ConnectionContext connection) => Task.CompletedTask;
        public Task Remove(ConnectionContext context) => Task.CompletedTask;
        public ICollection<Connection> GetEnvConnections(Guid envId)
            => _connections.Where(c => c.EnvId == envId).ToList();
        public ICollection<Connection> GetAllConnections() => _connections;
    }

    private async Task SeedIndexAsync(Guid envId, string id, long score)
        => await _db.SortedSetAddAsync(RedisKeys.FlagIndex(envId), id, score);

    private async Task SeedSegmentIndexAsync(Guid envId, string id, long score)
        => await _db.SortedSetAddAsync(RedisKeys.SegmentIndex(envId), id, score);

    [DockerFact]
    public async Task ReadAsync_ReturnsMaxCommittedScore_ForEnv()
    {
        // Arrange — committed scores {1000, 2000} in the env's flag index.
        var env = Guid.NewGuid();
        await SeedIndexAsync(env, Guid.NewGuid().ToString(), 1000);
        await SeedIndexAsync(env, Guid.NewGuid().ToString(), 2000);

        var sut = new RedisAppliedWatermarkReader(_redisClient, new FakeConnectionManager(env));

        // Act
        var watermarks = await sut.ReadAsync();

        // Assert — the watermark is the max committed score, regardless of any consumed messages.
        Assert.Equal(2000, watermarks[env]);
    }

    [DockerFact]
    public async Task ReadAsync_ColdStart_ReportsCommittedState_WithoutAnyConsumption()
    {
        // Arrange — Redis already holds committed flags; this reader instance is brand new and has
        // consumed nothing. It must still report the DC's committed serving state.
        var env = Guid.NewGuid();
        await SeedIndexAsync(env, Guid.NewGuid().ToString(), 1000);
        await SeedIndexAsync(env, Guid.NewGuid().ToString(), 2000);

        var freshReader = new RedisAppliedWatermarkReader(_redisClient, new FakeConnectionManager(env));

        // Act
        var watermarks = await freshReader.ReadAsync();

        // Assert
        Assert.Equal(2000, watermarks[env]);
    }

    [DockerFact]
    public async Task ReadAsync_TwoReaders_SameRedis_ReportSameValue()
    {
        // Arrange — two independent reader instances (modeling two pods) over the same Redis.
        var env = Guid.NewGuid();
        await SeedIndexAsync(env, Guid.NewGuid().ToString(), 1500);
        await SeedIndexAsync(env, Guid.NewGuid().ToString(), 4200);

        var podA = new RedisAppliedWatermarkReader(_redisClient, new FakeConnectionManager(env));
        var podB = new RedisAppliedWatermarkReader(_redisClient, new FakeConnectionManager(env));

        // Act
        var a = await podA.ReadAsync();
        var b = await podB.ReadAsync();

        // Assert
        Assert.Equal(4200, a[env]);
        Assert.Equal(a[env], b[env]);
    }

    [DockerFact]
    public async Task ReadAsync_EnvWithNoCommittedFlags_IsAbsent()
    {
        // Arrange — env has active connections but no committed flag index.
        var env = Guid.NewGuid();
        var sut = new RedisAppliedWatermarkReader(_redisClient, new FakeConnectionManager(env));

        // Act
        var watermarks = await sut.ReadAsync();

        // Assert — absent (and certainly not a spurious value).
        Assert.False(watermarks.ContainsKey(env));
    }

    [DockerFact]
    public async Task ReadAsync_NoConnections_FallsBackToScanningFlagIndexKeyspace()
    {
        // Arrange — no active connections, but Redis holds committed flag indexes for two envs.
        var env1 = Guid.NewGuid();
        var env2 = Guid.NewGuid();
        await SeedIndexAsync(env1, Guid.NewGuid().ToString(), 1000);
        await SeedIndexAsync(env1, Guid.NewGuid().ToString(), 3000);
        await SeedIndexAsync(env2, Guid.NewGuid().ToString(), 500);

        var sut = new RedisAppliedWatermarkReader(_redisClient, new FakeConnectionManager());

        // Act
        var watermarks = await sut.ReadAsync();

        // Assert — both envs discovered via SCAN, each at its max committed score.
        Assert.Equal(3000, watermarks[env1]);
        Assert.Equal(500, watermarks[env2]);
    }

    [DockerFact]
    public async Task ReadAsync_OnlyReportsConnectedEnvs_WhenConnectionsExist()
    {
        // Arrange — Redis holds indexes for two envs, but the pod is only connected to one.
        var connectedEnv = Guid.NewGuid();
        var otherEnv = Guid.NewGuid();
        await SeedIndexAsync(connectedEnv, Guid.NewGuid().ToString(), 2000);
        await SeedIndexAsync(otherEnv, Guid.NewGuid().ToString(), 9000);

        var sut = new RedisAppliedWatermarkReader(_redisClient, new FakeConnectionManager(connectedEnv));

        // Act
        var watermarks = await sut.ReadAsync();

        // Assert — only the connected env is reported (connections are the primary enumeration).
        Assert.Equal(2000, watermarks[connectedEnv]);
        Assert.False(watermarks.ContainsKey(otherEnv));
    }

    [DockerFact]
    public async Task SegmentOnlyEnv_IsReported()
    {
        // Arrange — env has only a segment index entry, no flag index entry at all.
        var env = Guid.NewGuid();
        await SeedSegmentIndexAsync(env, Guid.NewGuid().ToString(), 2500);

        var sut = new RedisAppliedWatermarkReader(_redisClient, new FakeConnectionManager(env));

        // Act
        var watermarks = await sut.ReadAsync();

        // Assert — the watermark is the segment index's top score.
        Assert.Equal(2500, watermarks[env]);
    }

    [DockerFact]
    public async Task Env_With_BothIndexes_Reports_Max()
    {
        // Arrange — flag score < segment score: segment score should win.
        var envSegmentWins = Guid.NewGuid();
        await SeedIndexAsync(envSegmentWins, Guid.NewGuid().ToString(), 1000);
        await SeedSegmentIndexAsync(envSegmentWins, Guid.NewGuid().ToString(), 3000);

        // Arrange — flag score > segment score: flag score should win.
        var envFlagWins = Guid.NewGuid();
        await SeedIndexAsync(envFlagWins, Guid.NewGuid().ToString(), 5000);
        await SeedSegmentIndexAsync(envFlagWins, Guid.NewGuid().ToString(), 1500);

        var sut = new RedisAppliedWatermarkReader(
            _redisClient,
            new FakeConnectionManager(envSegmentWins, envFlagWins));

        // Act
        var watermarks = await sut.ReadAsync();

        // Assert
        Assert.Equal(3000, watermarks[envSegmentWins]);
        Assert.Equal(5000, watermarks[envFlagWins]);
    }

    [DockerFact]
    public async Task ScanFallback_Discovers_SegmentOnlyEnvs()
    {
        // Arrange — no active connections; one env has only a flag index, another only a segment
        // index.
        var flagOnlyEnv = Guid.NewGuid();
        var segmentOnlyEnv = Guid.NewGuid();
        await SeedIndexAsync(flagOnlyEnv, Guid.NewGuid().ToString(), 1000);
        await SeedSegmentIndexAsync(segmentOnlyEnv, Guid.NewGuid().ToString(), 2000);

        var sut = new RedisAppliedWatermarkReader(_redisClient, new FakeConnectionManager());

        // Act
        var watermarks = await sut.ReadAsync();

        // Assert — both envs discovered via SCAN across both index patterns.
        Assert.Equal(1000, watermarks[flagOnlyEnv]);
        Assert.Equal(2000, watermarks[segmentOnlyEnv]);
    }

    /// <summary>
    /// #104: the zero-connections SCAN fallback (<c>EnumerateEnvIds</c> -&gt;
    /// <c>ScanIndexEnvIds</c>) used to run two full-keyspace SCAN passes on every single
    /// <see cref="RedisAppliedWatermarkReader.ReadAsync"/> call — forever, on a standby/passive
    /// DC's pods, which never accumulate connections. It is now cached for a TTL. This test drives
    /// the cache via the internal (test-only) constructor's settable TTL/clock seam: a read within
    /// the TTL must NOT pick up an env added to the index after the first scan, while a read after
    /// the TTL expires must.
    /// </summary>
    [DockerFact]
    public async Task ScanFallback_CachesEnvIds_WithinTtl_AndRefreshesAfterExpiry()
    {
        // Arrange — no active connections, one env already committed.
        var env1 = Guid.NewGuid();
        await SeedIndexAsync(env1, Guid.NewGuid().ToString(), 1000);

        var clock = new FakeClock(DateTimeOffset.UtcNow);
        var sut = new RedisAppliedWatermarkReader(
            _redisClient,
            new FakeConnectionManager(),
            scanCacheTtl: TimeSpan.FromSeconds(30),
            now: clock.Now);

        var first = await sut.ReadAsync();
        Assert.Equal(1000, first[env1]);

        // A second env is committed after the first scan, but the cache is still within its TTL.
        var env2 = Guid.NewGuid();
        await SeedIndexAsync(env2, Guid.NewGuid().ToString(), 2000);

        clock.Advance(TimeSpan.FromSeconds(10)); // 10s since the first scan, still < 30s TTL
        var second = await sut.ReadAsync();
        Assert.False(
            second.ContainsKey(env2),
            "a read within the cache TTL should reuse the cached env-id set, not re-SCAN");

        // Advance past the TTL (40s since the first scan) — the next read must re-SCAN and pick
        // up the newly committed env.
        clock.Advance(TimeSpan.FromSeconds(30));
        var third = await sut.ReadAsync();
        Assert.Equal(1000, third[env1]);
        Assert.Equal(2000, third[env2]);
    }

    /// <summary>Settable clock for exercising the SCAN-fallback cache's TTL without sleeping.</summary>
    private sealed class FakeClock(DateTimeOffset start)
    {
        private DateTimeOffset _now = start;

        public DateTimeOffset Now() => _now;

        public void Advance(TimeSpan by) => _now += by;
    }

    public Task DisposeAsync()
    {
        _connection?.Dispose();
        return Task.CompletedTask;
    }
}
