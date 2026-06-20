using System.Text.Json;
using Domain.ReleaseDecisions;
using Infrastructure.Services.EntityFrameworkCore;

namespace Application.UnitTests.Insights;

public class ReleaseDecisionInsightServiceTests
{
    [Fact]
    public void TryParseBuildsExposureEventFromFlagValueInsight()
    {
        var service = new ReleaseDecisionInsightService(null!);
        var id = Guid.NewGuid();
        var envId = Guid.NewGuid();
        var json = JsonSerializer.Serialize(new
        {
            uuid = id,
            distinct_id = "user-1",
            env_id = envId.ToString(),
            @event = "FlagValue",
            properties = JsonSerializer.Serialize(new
            {
                featureFlagKey = "checkout-onboarding",
                userKeyId = "user-1",
                variationId = "treatment-id",
                variationValue = "true"
            }),
            timestamp = 1_710_000_000_000_000L
        });

        var success = service.TryParse(json, out var insight);

        Assert.True(success);
        var exposure = Assert.IsType<ReleaseDecisionExposureEvent>(insight);
        Assert.Equal(id, exposure.Id);
        Assert.Equal(envId, exposure.EnvId);
        Assert.Equal("checkout-onboarding", exposure.FlagKey);
        Assert.Equal("user-1", exposure.UserKey);
        Assert.Equal("treatment-id", exposure.VariationId);
        Assert.Equal("true", exposure.VariationValue);
    }

    [Fact]
    public void TryParseBuildsMetricEventFromTrackedInsight()
    {
        var service = new ReleaseDecisionInsightService(null!);
        var id = Guid.NewGuid();
        var envId = Guid.NewGuid();
        var json = JsonSerializer.Serialize(new
        {
            uuid = id,
            distinct_id = "fallback-event",
            env_id = envId.ToString(),
            @event = "Track",
            properties = JsonSerializer.Serialize(new
            {
                user = new { keyId = "user-1" },
                eventName = "checkout_activated",
                numericValue = 3.5
            }),
            timestamp = 1_710_000_000_000_000L
        });

        var success = service.TryParse(json, out var insight);

        Assert.True(success);
        var metric = Assert.IsType<ReleaseDecisionMetricEvent>(insight);
        Assert.Equal(id, metric.Id);
        Assert.Equal(envId, metric.EnvId);
        Assert.Equal("user-1", metric.UserKey);
        Assert.Equal("checkout_activated", metric.EventName);
        Assert.Equal("Track", metric.EventType);
        Assert.Equal(3.5, metric.NumericValue);
    }

    [Fact]
    public void TryParseReturnsFalseForInvalidInsight()
    {
        var service = new ReleaseDecisionInsightService(null!);

        var success = service.TryParse("not-json", out var insight);

        Assert.False(success);
        Assert.Null(insight);
    }
}
