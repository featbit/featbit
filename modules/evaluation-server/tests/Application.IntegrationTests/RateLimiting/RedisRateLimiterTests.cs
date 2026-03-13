using Api.RateLimiting;
using Infrastructure.Caches.Redis;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using StackExchange.Redis;

namespace Application.IntegrationTests.RateLimiting;

public class RedisRateLimiterTests
{
    private static readonly ILogger<RedisRateLimiter> NullLogger =
        NullLoggerFactory.Instance.CreateLogger<RedisRateLimiter>();

    [Theory]
    [InlineData(RateLimiterType.FixedWindow)]
    [InlineData(RateLimiterType.SlidingWindow)]
    [InlineData(RateLimiterType.TokenBucket)]
    public async Task AcquireAsync_FailsOpen_WhenRedisThrowsRedisException(RateLimiterType limiterType)
    {
        var redisClient = new Mock<IRedisClient>();
        redisClient
            .Setup(x => x.GetDatabase())
            .Throws(new RedisException("redis unavailable"));

        using var limiter = new RedisRateLimiter(
            redisClient.Object,
            partitionKey: "Sdk:env-1",
            type: limiterType,
            permitLimit: 1,
            window: TimeSpan.FromSeconds(60),
            tokenLimit: 1,
            tokensPerPeriod: 1,
            replenishmentPeriod: TimeSpan.FromSeconds(60),
            logger: NullLogger);

        var lease = await limiter.AcquireAsync(permitCount: 1, cancellationToken: CancellationToken.None);

        Assert.True(lease.IsAcquired);
    }

    [Theory]
    [InlineData(RateLimiterType.FixedWindow)]
    [InlineData(RateLimiterType.SlidingWindow)]
    [InlineData(RateLimiterType.TokenBucket)]
    public async Task AcquireAsync_FailsOpen_WhenRedisThrowsRedisTimeoutException(RateLimiterType limiterType)
    {
        var redisClient = new Mock<IRedisClient>();
        redisClient
            .Setup(x => x.GetDatabase())
            .Throws(new RedisTimeoutException("redis timed out", CommandStatus.Unknown));

        using var limiter = new RedisRateLimiter(
            redisClient.Object,
            partitionKey: "Sdk:env-1",
            type: limiterType,
            permitLimit: 1,
            window: TimeSpan.FromSeconds(60),
            tokenLimit: 1,
            tokensPerPeriod: 1,
            replenishmentPeriod: TimeSpan.FromSeconds(60),
            logger: NullLogger);

        var lease = await limiter.AcquireAsync(permitCount: 1, cancellationToken: CancellationToken.None);

        Assert.True(lease.IsAcquired);
    }

    [Theory]
    [InlineData(RateLimiterType.FixedWindow)]
    [InlineData(RateLimiterType.SlidingWindow)]
    [InlineData(RateLimiterType.TokenBucket)]
    public async Task AcquireAsync_Propagates_NonRedisExceptions(RateLimiterType limiterType)
    {
        var redisClient = new Mock<IRedisClient>();
        redisClient
            .Setup(x => x.GetDatabase())
            .Throws(new InvalidOperationException("unexpected error"));

        using var limiter = new RedisRateLimiter(
            redisClient.Object,
            partitionKey: "Sdk:env-1",
            type: limiterType,
            permitLimit: 1,
            window: TimeSpan.FromSeconds(60),
            tokenLimit: 1,
            tokensPerPeriod: 1,
            replenishmentPeriod: TimeSpan.FromSeconds(60),
            logger: NullLogger);

        await Assert.ThrowsAsync<InvalidOperationException>(
            () => limiter.AcquireAsync(permitCount: 1, cancellationToken: CancellationToken.None).AsTask());
    }

    [Theory]
    [InlineData(RateLimiterType.FixedWindow)]
    [InlineData(RateLimiterType.SlidingWindow)]
    public void Constructor_Throws_WhenWindowLessThanOneSecond(RateLimiterType limiterType)
    {
        var redisClient = new Mock<IRedisClient>();

        Assert.Throws<ArgumentOutOfRangeException>(() => new RedisRateLimiter(
            redisClient.Object,
            partitionKey: "Sdk:env-1",
            type: limiterType,
            permitLimit: 1,
            window: TimeSpan.FromMilliseconds(500),
            tokenLimit: 1,
            tokensPerPeriod: 1,
            replenishmentPeriod: TimeSpan.FromSeconds(60),
            logger: NullLogger));
    }

    [Fact]
    public void Constructor_Throws_WhenReplenishmentPeriodLessThanOneSecond()
    {
        var redisClient = new Mock<IRedisClient>();

        Assert.Throws<ArgumentOutOfRangeException>(() => new RedisRateLimiter(
            redisClient.Object,
            partitionKey: "Sdk:env-1",
            type: RateLimiterType.TokenBucket,
            permitLimit: 1,
            window: TimeSpan.FromSeconds(60),
            tokenLimit: 1,
            tokensPerPeriod: 1,
            replenishmentPeriod: TimeSpan.FromMilliseconds(500),
            logger: NullLogger));
    }

    [Fact]
    public void Constructor_DoesNotThrow_WhenWindowBelowMinimum_ForTokenBucket()
    {
        // TokenBucket does not use window; sub-second value should not throw.
        var redisClient = new Mock<IRedisClient>();

        var ex = Record.Exception(() => new RedisRateLimiter(
            redisClient.Object,
            partitionKey: "Sdk:env-1",
            type: RateLimiterType.TokenBucket,
            permitLimit: 1,
            window: TimeSpan.FromMilliseconds(500),
            tokenLimit: 1,
            tokensPerPeriod: 1,
            replenishmentPeriod: TimeSpan.FromSeconds(60),
            logger: NullLogger));

        Assert.Null(ex);
    }

    [Theory]
    [InlineData(RateLimiterType.FixedWindow)]
    [InlineData(RateLimiterType.SlidingWindow)]
    public void Constructor_DoesNotThrow_WhenReplenishmentPeriodBelowMinimum_ForWindowLimiters(RateLimiterType limiterType)
    {
        // FixedWindow and SlidingWindow do not use replenishmentPeriod; sub-second value should not throw.
        var redisClient = new Mock<IRedisClient>();

        var ex = Record.Exception(() => new RedisRateLimiter(
            redisClient.Object,
            partitionKey: "Sdk:env-1",
            type: limiterType,
            permitLimit: 1,
            window: TimeSpan.FromSeconds(60),
            tokenLimit: 1,
            tokensPerPeriod: 1,
            replenishmentPeriod: TimeSpan.FromMilliseconds(500),
            logger: NullLogger));

        Assert.Null(ex);
    }

    [Fact]
    public void IdleDuration_IsExposed()
    {
        var redisClient = new Mock<IRedisClient>();

        using var limiter = new RedisRateLimiter(
            redisClient.Object,
            partitionKey: "Sdk:env-1",
            type: RateLimiterType.FixedWindow,
            permitLimit: 1,
            window: TimeSpan.FromSeconds(60),
            tokenLimit: 1,
            tokensPerPeriod: 1,
            replenishmentPeriod: TimeSpan.FromSeconds(60),
            logger: NullLogger);

        var idleDuration = limiter.IdleDuration;

        Assert.NotNull(idleDuration);
        Assert.True(idleDuration >= TimeSpan.Zero);
    }
}
