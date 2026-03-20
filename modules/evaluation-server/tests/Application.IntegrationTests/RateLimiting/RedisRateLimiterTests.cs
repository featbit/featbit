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

        var options = new EffectiveOptions("Sdk", new RateLimitingOptions
        {
            Type = limiterType,
            PermitLimit = 1,
            WindowSeconds = 60,
            TokenLimit = 1,
            TokensPerPeriod = 1,
            ReplenishmentPeriodSeconds = 60
        });

        var limiter = new RedisRateLimiter(redisClient.Object, "Sdk:env-1", options, NullLogger);
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

        var options = new EffectiveOptions("Sdk", new RateLimitingOptions
        {
            Type = limiterType,
            PermitLimit = 1,
            WindowSeconds = 60,
            TokenLimit = 1,
            TokensPerPeriod = 1,
            ReplenishmentPeriodSeconds = 60
        });

        var limiter = new RedisRateLimiter(redisClient.Object, "Sdk:env-1", options, NullLogger);
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

        var options = new EffectiveOptions("Sdk", new RateLimitingOptions
        {
            Type = limiterType,
            PermitLimit = 1,
            WindowSeconds = 60,
            TokenLimit = 1,
            TokensPerPeriod = 1,
            ReplenishmentPeriodSeconds = 60
        });

        var limiter = new RedisRateLimiter(redisClient.Object, "Sdk:env-1", options, NullLogger);

        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            limiter.AcquireAsync(permitCount: 1, cancellationToken: CancellationToken.None).AsTask()
        );
    }

    [Fact]
    public void IdleDuration_IsExposed()
    {
        var redisClient = new Mock<IRedisClient>();

        var options = new EffectiveOptions("Sdk", new RateLimitingOptions
        {
            Type = RateLimiterType.FixedWindow,
            PermitLimit = 1,
            WindowSeconds = 60,
            TokenLimit = 1,
            TokensPerPeriod = 1,
            ReplenishmentPeriodSeconds = 60
        });
        using var limiter = new RedisRateLimiter(redisClient.Object, "Sdk:env-1", options, NullLogger);

        var idleDuration = limiter.IdleDuration;

        Assert.NotNull(idleDuration);
        Assert.True(idleDuration >= TimeSpan.Zero);
    }
}