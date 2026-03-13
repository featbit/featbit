using Api.RateLimiting;
using Infrastructure.Caches.Redis;
using Moq;

namespace Application.IntegrationTests.RateLimiting;

public class RedisRateLimiterTests
{
    [Theory]
    [InlineData(RateLimiterType.FixedWindow)]
    [InlineData(RateLimiterType.SlidingWindow)]
    [InlineData(RateLimiterType.TokenBucket)]
    public async Task AcquireAsync_FailsOpen_WhenRedisUnavailable(RateLimiterType limiterType)
    {
        var redisClient = new Mock<IRedisClient>();
        redisClient
            .Setup(x => x.GetDatabase())
            .Throws(new Exception("redis unavailable"));

        using var limiter = new RedisRateLimiter(
            redisClient.Object,
            partitionKey: "Sdk:env-1",
            type: limiterType,
            permitLimit: 1,
            window: TimeSpan.FromSeconds(60),
            tokenLimit: 1,
            tokensPerPeriod: 1,
            replenishmentPeriod: TimeSpan.FromSeconds(60));

        var lease = await limiter.AcquireAsync(permitCount: 1, cancellationToken: CancellationToken.None);

        Assert.True(lease.IsAcquired);
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
            replenishmentPeriod: TimeSpan.FromSeconds(60));

        var idleDuration = limiter.IdleDuration;

        Assert.NotNull(idleDuration);
        Assert.True(idleDuration >= TimeSpan.Zero);
    }
}
