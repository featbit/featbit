using Api.RateLimiting;

namespace Application.IntegrationTests.RateLimiting;

public class EffectiveOptionsTests
{
    [Theory]
    [InlineData(RateLimiterType.FixedWindow, 0)]
    [InlineData(RateLimiterType.FixedWindow, -1)]
    [InlineData(RateLimiterType.SlidingWindow, 0)]
    [InlineData(RateLimiterType.SlidingWindow, -5)]
    public void WindowLimiters_Throw_WhenWindowSecondsIsLessThanOne(RateLimiterType limiterType, int windowSeconds)
    {
        Assert.Throws<ArgumentOutOfRangeException>(() =>
            new EffectiveOptions("Sdk", new RateLimitingOptions
            {
                Type = limiterType,
                WindowSeconds = windowSeconds
            }));
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    public void TokenBucket_Throws_WhenReplenishmentPeriodSecondsIsLessThanOne(int replenishmentPeriodSeconds)
    {
        Assert.Throws<ArgumentOutOfRangeException>(() =>
            new EffectiveOptions("Sdk", new RateLimitingOptions
            {
                Type = RateLimiterType.TokenBucket,
                ReplenishmentPeriodSeconds = replenishmentPeriodSeconds
            }));
    }

    [Theory]
    [InlineData(RateLimiterType.FixedWindow)]
    [InlineData(RateLimiterType.SlidingWindow)]
    public void WindowLimiters_Throw_WhenEndpointOverride_SetsWindowSecondsToInvalidValue(RateLimiterType limiterType)
    {
        // The global WindowSeconds is valid, but the endpoint override reduces it to an invalid value.
        var global = new RateLimitingOptions
        {
            Type = limiterType,
            WindowSeconds = 60,
            Endpoints = { ["Sdk"] = new EndpointRateLimitOptions { WindowSeconds = 0 } }
        };

        Assert.Throws<ArgumentOutOfRangeException>(() => new EffectiveOptions("Sdk", global));
    }

    [Fact]
    public void Constructor_ReflectsAllGlobalDefaults_WhenNoPolicyEndpointExists()
    {
        var global = new RateLimitingOptions
        {
            Type = RateLimiterType.FixedWindow,
            PermitLimit = 200,
            WindowSeconds = 30,
            QueueLimit = 5,
            SegmentsPerWindow = 8,
            TokenLimit = 150,
            TokensPerPeriod = 75,
            ReplenishmentPeriodSeconds = 15
        };

        var effective = new EffectiveOptions("UnknownPolicy", global);

        Assert.Equal(RateLimiterType.FixedWindow, effective.Type);
        Assert.Equal(200, effective.PermitLimit);
        Assert.Equal(30, effective.WindowSeconds);
        Assert.Equal(5, effective.QueueLimit);
        Assert.Equal(8, effective.SegmentsPerWindow);
        Assert.Equal(150, effective.TokenLimit);
        Assert.Equal(75, effective.TokensPerPeriod);
        Assert.Equal(15, effective.ReplenishmentPeriodSeconds);
    }

    [Fact]
    public void EndpointOverride_OverridesAllFields_WhenAllAreSpecified()
    {
        var global = new RateLimitingOptions
        {
            Type = RateLimiterType.FixedWindow,
            PermitLimit = 100,
            WindowSeconds = 60,
            QueueLimit = 0,
            SegmentsPerWindow = 4,
            TokenLimit = 100,
            TokensPerPeriod = 50,
            ReplenishmentPeriodSeconds = 60,
            Endpoints =
            {
                ["Sdk"] = new EndpointRateLimitOptions
                {
                    Type = RateLimiterType.SlidingWindow,
                    PermitLimit = 500,
                    WindowSeconds = 30,
                    QueueLimit = 10,
                    SegmentsPerWindow = 6,
                    TokenLimit = 200,
                    TokensPerPeriod = 100,
                    ReplenishmentPeriodSeconds = 45
                }
            }
        };

        var effective = new EffectiveOptions("Sdk", global);

        Assert.Equal(RateLimiterType.SlidingWindow, effective.Type);
        Assert.Equal(500, effective.PermitLimit);
        Assert.Equal(30, effective.WindowSeconds);
        Assert.Equal(10, effective.QueueLimit);
        Assert.Equal(6, effective.SegmentsPerWindow);
        Assert.Equal(200, effective.TokenLimit);
        Assert.Equal(100, effective.TokensPerPeriod);
        Assert.Equal(45, effective.ReplenishmentPeriodSeconds);
    }

    [Fact]
    public void EndpointOverride_PreservesGlobalDefaults_ForUnspecifiedFields()
    {
        var global = new RateLimitingOptions
        {
            Type = RateLimiterType.FixedWindow,
            PermitLimit = 100,
            WindowSeconds = 60,
            QueueLimit = 3,
            Endpoints = { ["Sdk"] = new EndpointRateLimitOptions { PermitLimit = 500 } }
        };

        var effective = new EffectiveOptions("Sdk", global);

        Assert.Equal(500, effective.PermitLimit);   // overridden
        Assert.Equal(60, effective.WindowSeconds);  // inherited
        Assert.Equal(3, effective.QueueLimit);      // inherited
    }

    [Fact]
    public void EndpointOverride_IsMatchedCaseInsensitively()
    {
        // Key stored in upper-case, policy name looked up in lower-case.
        var global = new RateLimitingOptions
        {
            Type = RateLimiterType.FixedWindow,
            PermitLimit = 100,
            WindowSeconds = 60,
            Endpoints = { ["SDK"] = new EndpointRateLimitOptions { PermitLimit = 999 } }
        };

        var effective = new EffectiveOptions("sdk", global);

        Assert.Equal(999, effective.PermitLimit);
    }

    [Fact]
    public void EndpointOverride_ForDifferentPolicy_DoesNotAffectCurrentPolicy()
    {
        var global = new RateLimitingOptions
        {
            Type = RateLimiterType.FixedWindow,
            PermitLimit = 100,
            WindowSeconds = 60,
            Endpoints = { ["Streaming"] = new EndpointRateLimitOptions { PermitLimit = 5 } }
        };

        var effective = new EffectiveOptions("Sdk", global);

        // Streaming override must not bleed into the Sdk policy.
        Assert.Equal(100, effective.PermitLimit);
    }
}