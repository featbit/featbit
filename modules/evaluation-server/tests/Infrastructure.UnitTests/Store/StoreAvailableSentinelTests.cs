using Domain.Shared;
using Infrastructure.Store;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Testing;
using Moq;

namespace Infrastructure.UnitTests.Store;

[Collection(StoreSingletonCollection.Name)]
public class StoreAvailableSentinelTests : IDisposable
{
    private const string Redis = Stores.Redis;
    private const string Postgres = Stores.Postgres;

    private readonly Mock<IDbStore> _redis = new();
    private readonly Mock<IDbStore> _postgres = new();
    private readonly FakeClock _clock = new();
    private readonly FakeLogger<StoreAvailableSentinel> _logger = new();
    private readonly StoreAvailableSentinel _sentinel;

    private bool _threadPoolBusy;

    public StoreAvailableSentinelTests()
    {
        StoreAvailabilityListenerReset.Reset();

        _redis.Setup(x => x.Name).Returns(Redis);
        _postgres.Setup(x => x.Name).Returns(Postgres);
        SetRedis(true);
        SetPostgres(true);

        var options = new StoreAvailabilityOptions { CheckTimeoutMilliseconds = 100 };

        // registered out of priority order on purpose: the sentinel orders them by name
        IDbStore[] stores = [_postgres.Object, _redis.Object];
        _sentinel = new StoreAvailableSentinel(
            new ServiceCollection().AddSingleton(Mock.Of<IStore>()).BuildServiceProvider(),
            stores,
            options,
            StoreAvailabilityListener.Instance,
            _clock,
            _logger,
            () => new FakeProbe(() => !_threadPoolBusy));
    }

    public void Dispose() => StoreAvailabilityListenerReset.Reset();

    private static string Routed => StoreAvailabilityListener.Instance.AvailableStore;

    private void SetRedis(bool available) => _redis.Setup(x => x.IsAvailableAsync()).ReturnsAsync(available);

    private void SetPostgres(bool available) => _postgres.Setup(x => x.IsAvailableAsync()).ReturnsAsync(available);

    private void Check(int times)
    {
        for (var i = 0; i < times; i++)
        {
            _sentinel.CheckOnce();
            _clock.Advance(TimeSpan.FromSeconds(6));
        }
    }

    [Fact]
    public void ReadsStartOnTheHighestPriorityStore() => Assert.Equal(Redis, Routed);

    [Fact]
    public void HealthyRedis_ChecksOnlyRedis()
    {
        Check(3);

        Assert.Equal(Redis, Routed);
        _redis.Verify(x => x.IsAvailableAsync(), Times.Exactly(3));
        _postgres.Verify(x => x.IsAvailableAsync(), Times.Never);
    }

    [Fact]
    public void OneFailedRedisCheck_DoesNotMoveReads()
    {
        SetRedis(false);
        Check(1);

        Assert.Equal(Redis, Routed);
    }

    [Fact]
    public void ThreeFailedRedisChecks_MoveReadsToTheDatabase()
    {
        SetRedis(false);

        Check(2);
        Assert.Equal(Redis, Routed);

        Check(1);
        Assert.Equal(Postgres, Routed);
    }

    [Fact]
    public void ReadsReturnToRedis_AfterFiveHealthyChecksAndTheMinimumDwell()
    {
        SetRedis(false);
        Check(3);
        Assert.Equal(Postgres, Routed);

        // the fifth healthy check comes 30 seconds after the change: held by the dwell
        SetRedis(true);
        Check(5);
        Assert.Equal(Postgres, Routed);

        // the first check at or past 60 seconds moves reads back
        Check(5);
        Assert.Equal(Redis, Routed);
    }

    [Fact]
    public void ARedisThatFailsEveryOtherCheck_NeverMovesReads()
    {
        for (var i = 0; i < 40; i++)
        {
            SetRedis(i % 2 == 1);
            Check(1);
        }

        Assert.Equal(Redis, Routed);
    }

    [Fact]
    public void WhenNoStoreAnswers_ReadsStayWhereTheyWereAndAnErrorIsLoggedPerCheck()
    {
        SetRedis(false);
        SetPostgres(false);

        Check(5);

        Assert.Equal(Redis, Routed);
        Assert.Equal(5, _logger.Collector.GetSnapshot().Count(r =>
            r.Level == LogLevel.Error && r.Message == "No available store can be used."));
    }

    [Fact]
    public void WhenOnlyTheDatabaseRecoversAfterNoStoreAnswered_ReadsMoveAfterThreeChecks()
    {
        SetRedis(false);
        SetPostgres(false);
        Check(3);

        SetPostgres(true);
        Check(2);
        Assert.Equal(Redis, Routed);

        Check(1);
        Assert.Equal(Postgres, Routed);
    }

    [Fact]
    public void ACheckThatBlocksBeforeItsFirstAwait_IsBoundedByTheBudget()
    {
        using var release = new ManualResetEventSlim();
        _redis.Setup(x => x.IsAvailableAsync()).Returns(() =>
        {
            release.Wait(TimeSpan.FromSeconds(10));
            return Task.FromResult(true);
        });

        var startedAt = DateTime.UtcNow;
        var decision = _sentinel.CheckOnce();
        var elapsed = DateTime.UtcNow - startedAt;
        release.Set();

        Assert.Equal(Postgres, decision.Observed);
        Assert.True(elapsed < TimeSpan.FromSeconds(5), $"check took {elapsed}");
    }

    [Fact]
    public void ACheckTimedOutBySaturation_IsIgnored()
    {
        _redis.Setup(x => x.IsAvailableAsync()).Returns(new TaskCompletionSource<bool>().Task);
        _threadPoolBusy = true;

        Check(10);

        Assert.Equal(Redis, Routed);
        // the stores below are not checked while the pod is saturated
        _postgres.Verify(x => x.IsAvailableAsync(), Times.Never);
        Assert.Contains(_logger.Collector.GetSnapshot(), r =>
            r.Level == LogLevel.Warning && r.Message.Contains("thread pool was saturated"));
    }

    [Fact]
    public void ACheckTimedOutByAHungStore_CountsAsAFailure()
    {
        _redis.Setup(x => x.IsAvailableAsync()).Returns(new TaskCompletionSource<bool>().Task);

        Check(3);

        Assert.Equal(Postgres, Routed);
    }

    [Fact]
    public void ACheckThatThrows_CountsAsAFailure()
    {
        _redis.Setup(x => x.IsAvailableAsync()).ThrowsAsync(new InvalidOperationException("boom"));

        Check(3);

        Assert.Equal(Postgres, Routed);
    }

    [Fact]
    public async Task StartAndStop_RunChecksOnTheirOwnThread()
    {
        await _sentinel.StartAsync(CancellationToken.None);

        var deadline = DateTime.UtcNow.AddSeconds(5);
        while (_redis.Invocations.Count(x => x.Method.Name == nameof(IDbStore.IsAvailableAsync)) == 0 &&
               DateTime.UtcNow < deadline)
        {
            await Task.Delay(10);
        }

        await _sentinel.StopAsync(CancellationToken.None);

        _redis.Verify(x => x.IsAvailableAsync(), Times.AtLeastOnce);
        Assert.Equal(Redis, Routed);
    }

    private sealed class FakeClock : TimeProvider
    {
        private DateTimeOffset _now = new(2026, 1, 1, 0, 0, 0, TimeSpan.Zero);

        public override DateTimeOffset GetUtcNow() => _now;

        public void Advance(TimeSpan by) => _now += by;
    }

    private sealed class FakeProbe(Func<bool> ran) : IThreadPoolProbe
    {
        public bool RanWithin(TimeSpan limit) => ran();
    }
}
