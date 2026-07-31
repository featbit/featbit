using System.Diagnostics;
using Api.Application.ControlPlane;
using Api.IntegrationTests.Fixtures;
using Infrastructure.Caches.Redis;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using StackExchange.Redis;

namespace Api.IntegrationTests.ControlPlane;

/// <summary>
/// #71a acceptance tests for <see cref="RedisLeaderElector"/>. Exercises exactly-one-leader semantics,
/// immediate handover on graceful stop, and TTL-based takeover on crash, against a real Redis.
///
/// Uses the shared Testcontainers Redis fixture. Uses short TTLs (1-2s) to keep the suite fast, and
/// flushes the lock key between tests so they don't interfere with each other.
/// </summary>
[Collection(RedisCollection.Name)]
public sealed class RedisLeaderElectorTests : IntegrationTestBase, IAsyncLifetime
{
    private readonly RedisFixture _fixture;
    private ConnectionMultiplexer _mux = null!;
    private readonly List<RedisLeaderElector> _electors = new();

    public RedisLeaderElectorTests(RedisFixture fixture)
    {
        _fixture = fixture;
    }

    public async Task InitializeAsync()
    {
        if (!DockerAvailability.IsAvailable)
        {
            return;
        }

        var redisOptions = ConfigurationOptions.Parse(_fixture.ConnectionString);
        redisOptions.AllowAdmin = true;
        _mux = await ConnectionMultiplexer.ConnectAsync(redisOptions);
        await _mux.GetDatabase().ExecuteAsync("FLUSHDB");
    }

    public async Task DisposeAsync()
    {
        foreach (var elector in _electors)
        {
            try
            {
                await elector.StopAsync(CancellationToken.None);
            }
            catch
            {
                // best-effort cleanup; a test failure should surface from the assertion, not here
            }

            elector.Dispose();
        }

        if (_mux is not null)
        {
            await _mux.GetDatabase().ExecuteAsync("FLUSHDB");
            _mux.Dispose();
        }
    }

    // ----- helpers -----

    private sealed class TestRedisClient(IConnectionMultiplexer connection) : IRedisClient
    {
        public IConnectionMultiplexer Connection { get; } = connection;

        public IDatabase GetDatabase() => Connection.GetDatabase();
    }

    /// <summary>
    /// Builds a <see cref="RedisLeaderElector"/> wired to the shared test Redis, with short,
    /// test-controlled TTL/renew-interval config overrides. Tracked for StopAsync/Dispose in
    /// <see cref="DisposeAsync"/>.
    /// </summary>
    private RedisLeaderElector CreateElector(TimeSpan ttl, TimeSpan renewInterval)
    {
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["ControlPlane:LeaderElection:TtlSeconds"] = ((int)ttl.TotalSeconds).ToString(),
                ["ControlPlane:LeaderElection:RenewIntervalSeconds"] =
                    ((int)renewInterval.TotalSeconds).ToString()
            })
            .Build();

        var elector = new RedisLeaderElector(
            new TestRedisClient(_mux),
            configuration,
            NullLogger<RedisLeaderElector>.Instance);

        _electors.Add(elector);
        return elector;
    }

    /// <summary>
    /// Polls <paramref name="condition"/> until it is true or <paramref name="timeout"/> elapses.
    /// Returns the final state of the condition (so callers can Assert.True with a useful message
    /// rather than a bare timeout exception).
    /// </summary>
    private static async Task<bool> WaitUntilAsync(
        Func<bool> condition,
        TimeSpan timeout,
        TimeSpan? pollInterval = null)
    {
        var interval = pollInterval ?? TimeSpan.FromMilliseconds(50);
        var stopwatch = Stopwatch.StartNew();

        while (stopwatch.Elapsed < timeout)
        {
            if (condition())
            {
                return true;
            }

            await Task.Delay(interval);
        }

        return condition();
    }

    // ----- acceptance cases -----

    [DockerFact]
    public async Task SingleElector_BecomesLeader_OnFirstAttempt()
    {
        var elector = CreateElector(ttl: TimeSpan.FromSeconds(2), renewInterval: TimeSpan.FromSeconds(1));

        await elector.StartAsync(CancellationToken.None);

        // ExecuteAsync attempts to acquire immediately on start (before the first PeriodicTimer tick),
        // so this should succeed well inside a single renew interval.
        var becameLeader = await WaitUntilAsync(
            () => elector.IsLeader,
            timeout: TimeSpan.FromSeconds(1));

        Assert.True(becameLeader, "Single elector should become leader on its first attempt.");
    }

    [DockerFact]
    public async Task TwoElectors_ExactlyOneBecomesLeader()
    {
        var electorA = CreateElector(ttl: TimeSpan.FromSeconds(2), renewInterval: TimeSpan.FromSeconds(1));
        var electorB = CreateElector(ttl: TimeSpan.FromSeconds(2), renewInterval: TimeSpan.FromSeconds(1));

        await electorA.StartAsync(CancellationToken.None);
        await electorB.StartAsync(CancellationToken.None);

        var oneBecameLeader = await WaitUntilAsync(
            () => electorA.IsLeader || electorB.IsLeader,
            timeout: TimeSpan.FromSeconds(2));
        Assert.True(oneBecameLeader, "One of the two electors should have become leader.");

        // Negative assertion via bounded poll (§9): watch for the VIOLATION — both claiming
        // leadership — across a couple more renew ticks, and expect the poll to time out.
        var bothClaimedLeadership = await WaitUntilAsync(
            () => electorA.IsLeader && electorB.IsLeader,
            timeout: TimeSpan.FromSeconds(1));
        Assert.False(
            bothClaimedLeadership,
            $"Expected exactly one leader; got A={electorA.IsLeader}, B={electorB.IsLeader}.");

        Assert.True(
            electorA.IsLeader ^ electorB.IsLeader,
            $"Expected exactly one leader; got A={electorA.IsLeader}, B={electorB.IsLeader}.");
    }

    [DockerFact]
    public async Task StoppedLeader_ReleasesLock_And_OtherTakesOver()
    {
        // TTL is intentionally much larger than the takeover window we assert on, so a pass here can
        // only be explained by the explicit release on stop, not by a coincidental TTL expiry.
        var ttl = TimeSpan.FromSeconds(10);
        var renewInterval = TimeSpan.FromSeconds(1);

        var electorA = CreateElector(ttl, renewInterval);
        var electorB = CreateElector(ttl, renewInterval);

        await electorA.StartAsync(CancellationToken.None);
        var aBecameLeader = await WaitUntilAsync(() => electorA.IsLeader, TimeSpan.FromSeconds(1));
        Assert.True(aBecameLeader, "Elector A should become leader first.");

        await electorB.StartAsync(CancellationToken.None);
        // Negative assertion via bounded poll (§9): watch for the VIOLATION — B claiming
        // leadership while A holds the lock — across at least one renew attempt, and expect
        // the poll to time out.
        var bClaimedLeadership = await WaitUntilAsync(
            () => electorB.IsLeader,
            timeout: renewInterval + TimeSpan.FromMilliseconds(200));
        Assert.False(bClaimedLeadership, "Elector B should not be leader while A holds the lock.");

        // Graceful stop releases the lock immediately.
        await electorA.StopAsync(CancellationToken.None);
        Assert.False(electorA.IsLeader);

        var bTookOver = await WaitUntilAsync(
            () => electorB.IsLeader,
            timeout: TimeSpan.FromSeconds(3));

        Assert.True(bTookOver, "Elector B should take over promptly after A releases the lock.");
    }

    [DockerFact]
    public async Task ExpiredLeader_IsSupersededAfterTtl()
    {
        var ttl = TimeSpan.FromSeconds(1);
        var renewInterval = TimeSpan.FromSeconds(1);

        // Simulate a crashed leader: take the lock directly with a foreign value and never release it.
        var foreignValue = Guid.NewGuid().ToString();
        var took = await _mux.GetDatabase().LockTakeAsync(RedisLeaderElector.LockKey, foreignValue, ttl);
        Assert.True(took, "Test setup should be able to take the lock with a foreign value.");

        var elector = CreateElector(ttl, renewInterval);
        var stopwatch = Stopwatch.StartNew();
        await elector.StartAsync(CancellationToken.None);

        var becameLeader = await WaitUntilAsync(
            () => elector.IsLeader,
            timeout: ttl + TimeSpan.FromSeconds(3));

        Assert.True(becameLeader, "A fresh elector should take over once the foreign lock's TTL expires.");

        // Sanity: takeover should not have been immediate — it had to wait out (close to) the TTL.
        Assert.True(
            stopwatch.Elapsed >= ttl - TimeSpan.FromMilliseconds(200),
            $"Takeover happened suspiciously fast ({stopwatch.Elapsed.TotalMilliseconds}ms) for a " +
            $"{ttl.TotalMilliseconds}ms TTL — expected it to wait out the foreign lock's expiry.");
    }
}
