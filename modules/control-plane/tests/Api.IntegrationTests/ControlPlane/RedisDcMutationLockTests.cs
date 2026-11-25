using Api.Application.ControlPlane;
using Api.Infrastructure.Caches;
using Api.IntegrationTests.Fixtures;
using Infrastructure.Caches.Redis;
using Microsoft.Extensions.Logging.Abstractions;
using StackExchange.Redis;

namespace Api.IntegrationTests.ControlPlane;

/// <summary>
/// <see cref="RedisDcMutationLock"/> against a real Redis: one holder at a time, waiting, renewal past the TTL, a lost
/// lock, and the shared record of what was pruned. Short TTLs keep the suite fast; the database is flushed between tests.
/// </summary>
[Collection(RedisCollection.Name)]
public sealed class RedisDcMutationLockTests : IntegrationTestBase, IAsyncLifetime
{
    private const string DcId = "east";

    private readonly RedisFixture _fixture;
    private ConnectionMultiplexer _mux = null!;

    public RedisDcMutationLockTests(RedisFixture fixture)
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
        _mux = await ConnectionMultiplexer.ConnectAsync(options);
        await _mux.GetDatabase().ExecuteAsync("FLUSHDB");
    }

    public async Task DisposeAsync()
    {
        if (_mux is not null)
        {
            await _mux.GetDatabase().ExecuteAsync("FLUSHDB");
            _mux.Dispose();
        }
    }

    private sealed class TestRedisClient(IConnectionMultiplexer connection) : IRedisClient
    {
        public IConnectionMultiplexer Connection { get; } = connection;

        public IDatabase GetDatabase() => Connection.GetDatabase();
    }

    /// <summary>A lock as one replica would hold it; two calls give two replicas over the same Redis.</summary>
    private RedisDcMutationLock CreateLock(TimeSpan? ttl = null, TimeSpan? renewInterval = null) =>
        new(
            [new DcRedisConnection(DcId, new TestRedisClient(_mux), IsLocal: true)],
            NullLogger<RedisDcMutationLock>.Instance,
            ttl ?? TimeSpan.FromSeconds(5),
            renewInterval ?? TimeSpan.FromSeconds(1),
            pollInterval: TimeSpan.FromMilliseconds(50));

    [DockerFact]
    public async Task TryAcquireAsync_OneReplicaHoldsTheLock_AnotherCannotTakeItUntilItIsReleased()
    {
        var first = CreateLock();
        var second = CreateLock();

        var lease = await first.TryAcquireAsync(DcId);
        Assert.NotNull(lease);
        Assert.True(lease.IsHeld);
        Assert.Null(await second.TryAcquireAsync(DcId));

        await lease.DisposeAsync();

        await using var next = await second.TryAcquireAsync(DcId);
        Assert.NotNull(next);
    }

    [DockerFact]
    public async Task AcquireAsync_TheLockIsHeld_WaitsUntilItIsReleased()
    {
        var holder = await CreateLock().TryAcquireAsync(DcId);
        Assert.NotNull(holder);

        var waiting = CreateLock().AcquireAsync(DcId);
        await Task.Delay(300);
        Assert.False(waiting.IsCompleted);

        await holder.DisposeAsync();
        await using var lease = await waiting.WaitAsync(TimeSpan.FromSeconds(5));
        Assert.True(lease.IsHeld);
    }

    [DockerFact]
    public async Task Lease_HeldLongerThanTheTtl_IsRenewed()
    {
        await using var lease = await CreateLock(TimeSpan.FromSeconds(1), TimeSpan.FromMilliseconds(200)).TryAcquireAsync(DcId);
        Assert.NotNull(lease);

        await Task.Delay(TimeSpan.FromSeconds(2.5));

        Assert.True(lease.IsHeld);
        Assert.Null(await CreateLock().TryAcquireAsync(DcId));
    }

    /// <summary>
    /// A holder whose lock expired and was taken by another replica learns at its next renewal that it lost it, and its
    /// release does not remove the new holder's lock.
    /// </summary>
    [DockerFact]
    public async Task Lease_WhoseLockWasTakenOver_IsNoLongerHeld_AndDoesNotReleaseTheNewHolder()
    {
        var lost = await CreateLock(TimeSpan.FromSeconds(5), TimeSpan.FromMilliseconds(200)).TryAcquireAsync(DcId);
        Assert.NotNull(lost);
        await _mux.GetDatabase().KeyDeleteAsync(RedisDcMutationLock.LockKey(DcId)); // as if it had expired
        await using var taker = await CreateLock().TryAcquireAsync(DcId);
        Assert.NotNull(taker);

        await Task.Delay(TimeSpan.FromSeconds(1));
        Assert.False(lost.IsHeld);
        await lost.DisposeAsync();

        Assert.True(await _mux.GetDatabase().KeyExistsAsync(RedisDcMutationLock.LockKey(DcId)));
        Assert.Null(await CreateLock().TryAcquireAsync(DcId));
    }

    /// <summary>A client whose commands can be made to fail, as when the connection to the DC's Redis drops.</summary>
    private sealed class FailingRedisClient(IConnectionMultiplexer connection) : IRedisClient
    {
        public bool Fail { get; set; }

        public IConnectionMultiplexer Connection { get; } = connection;

        public IDatabase GetDatabase() =>
            Fail ? throw new RedisConnectionException(ConnectionFailureType.SocketFailure, "down") : Connection.GetDatabase();
    }

    /// <summary>
    /// A holder whose renewals fail must stop counting the lock as held before the lock can expire and be taken by another
    /// replica, not after: here at TTL minus one renew interval (2 s), while the key still exists until 3 s.
    /// </summary>
    [DockerFact]
    public async Task Lease_WhoseRenewalsFail_StopsBeingHeldBeforeTheLockCanExpire()
    {
        var client = new FailingRedisClient(_mux);
        var dcLock = new RedisDcMutationLock(
            [new DcRedisConnection(DcId, client, IsLocal: true)],
            NullLogger<RedisDcMutationLock>.Instance,
            ttl: TimeSpan.FromSeconds(3),
            renewInterval: TimeSpan.FromSeconds(1));
        var lease = await dcLock.TryAcquireAsync(DcId);
        Assert.NotNull(lease);
        client.Fail = true;

        await Task.Delay(TimeSpan.FromSeconds(1.2));
        Assert.True(lease.IsHeld);
        await Task.Delay(TimeSpan.FromSeconds(1.2)); // 2.4 s after taking it

        Assert.False(lease.IsHeld);
        Assert.True(await _mux.GetDatabase().KeyExistsAsync(RedisDcMutationLock.LockKey(DcId))); // not expired yet
        client.Fail = false;
        await lease.DisposeAsync();
    }

    [DockerFact]
    public async Task PrunedRecord_CannotBeRead_ReturnsNullRatherThanAnEmptyRecord()
    {
        var client = new FailingRedisClient(_mux);
        var dcLock = new RedisDcMutationLock(
            [new DcRedisConnection(DcId, client, IsLocal: true)], NullLogger<RedisDcMutationLock>.Instance);
        await using var lease = await dcLock.AcquireAsync(DcId);
        client.Fail = true;

        Assert.Null(await lease.ReadPrunedAsync(DateTimeOffset.UtcNow.AddHours(-1)));
        client.Fail = false;
    }

    [DockerFact]
    public async Task PrunedRecord_IsSharedBetweenReplicas_AndForgetsOldEntries()
    {
        var now = DateTimeOffset.UtcNow;
        var recent = Guid.NewGuid();
        var old = Guid.NewGuid();
        await using (var lease = await CreateLock().AcquireAsync(DcId))
        {
            Assert.True(await lease.RecordPrunedAsync(recent, now));
            Assert.True(await lease.RecordPrunedAsync(old, now.AddHours(-2)));
        }

        await using var other = await CreateLock().AcquireAsync(DcId);
        var pruned = await other.ReadPrunedAsync(now.AddHours(-1));

        Assert.NotNull(pruned);
        Assert.Equal([recent], pruned.Keys);
        Assert.Equal(now.ToUnixTimeMilliseconds(), pruned[recent].ToUnixTimeMilliseconds());
        Assert.False(await _mux.GetDatabase().HashExistsAsync(RedisDcMutationLock.PrunedKey(DcId), old.ToString()));
    }

    [DockerFact]
    public async Task UnknownDc_AcquireAsyncReturnsALeaseThatIsNotHeld_AndTryAcquireAsyncReturnsNull()
    {
        var dcLock = CreateLock();

        await using var lease = await dcLock.AcquireAsync("unknown");

        Assert.False(lease.IsHeld);
        Assert.False(await lease.RecordPrunedAsync(Guid.NewGuid(), DateTimeOffset.UtcNow));
        Assert.Null(await dcLock.TryAcquireAsync("unknown"));
    }
}
