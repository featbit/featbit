using Api.RateLimiting;

namespace Application.IntegrationTests.RateLimiting;

public class EffectiveOptionsTests
{
    [Theory]
    [InlineData(RateLimiterType.FixedWindow)]
    [InlineData(RateLimiterType.SlidingWindow)]
    public void Constructor_Throws_WhenWindowSeconds_IsZero_ForWindowLimiters(RateLimiterType limiterType)
    {
        Assert.Throws<ArgumentOutOfRangeException>(() =>
            new EffectiveOptions("Sdk", new RateLimitingOptions { Type = limiterType, WindowSeconds = 0 }));
    }

    [Fact]
    public void Constructor_Throws_WhenReplenishmentPeriodSeconds_IsZero_ForTokenBucket()
    {
        Assert.Throws<ArgumentOutOfRangeException>(() =>
            new EffectiveOptions("Sdk", new RateLimitingOptions
            {
                Type = RateLimiterType.TokenBucket,
                ReplenishmentPeriodSeconds = 0
            }));
    }

    [Fact]
    public void Constructor_DoesNotThrow_WhenWindowSeconds_IsZero_ForTokenBucket()
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
    public void Constructor_DoesNotThrow_WhenReplenishmentPeriodSeconds_IsZero_ForWindowLimiters(
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