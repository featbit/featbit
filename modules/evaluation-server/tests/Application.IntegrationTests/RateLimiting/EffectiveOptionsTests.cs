using Api.RateLimiting;

namespace Application.IntegrationTests.RateLimiting;

public class EffectiveOptionsTests
{
    [Theory]
    [InlineData(RateLimiterType.FixedWindow)]
    [InlineData(RateLimiterType.SlidingWindow)]
    public void WindowLimiters_Throw_WhenWindowSecondsIsZero(RateLimiterType limiterType)
    {
        Assert.Throws<ArgumentOutOfRangeException>(() =>
            new EffectiveOptions("Sdk", new RateLimitingOptions { Type = limiterType, WindowSeconds = 0 }));
    }

    [Fact]
    public void TokenBucket_Throws_WhenReplenishmentPeriodSecondsIsZero()
    {
        Assert.Throws<ArgumentOutOfRangeException>(() =>
            new EffectiveOptions("Sdk", new RateLimitingOptions
            {
                Type = RateLimiterType.TokenBucket,
                ReplenishmentPeriodSeconds = 0
            }));
    }

    [Fact]
    public void TokenBucket_DoesNotThrow_WhenWindowSecondsIsZero()
    {
        // TokenBucket does not validate WindowSeconds.
        var ex = Record.Exception(() =>
            new EffectiveOptions("Sdk", new RateLimitingOptions
            {
                Type = RateLimiterType.TokenBucket,
                WindowSeconds = 0
            }));

        Assert.Null(ex);
    }

    [Theory]
    [InlineData(RateLimiterType.FixedWindow)]
    [InlineData(RateLimiterType.SlidingWindow)]
    public void WindowLimiters_DoesNotThrow_WhenReplenishmentPeriodSecondsIsZero(
        RateLimiterType limiterType)
    {
        // FixedWindow and SlidingWindow do not validate ReplenishmentPeriodSeconds.
        var ex = Record.Exception(() =>
            new EffectiveOptions("Sdk", new RateLimitingOptions
            {
                Type = limiterType,
                ReplenishmentPeriodSeconds = 0
            }));

        Assert.Null(ex);
    }
}