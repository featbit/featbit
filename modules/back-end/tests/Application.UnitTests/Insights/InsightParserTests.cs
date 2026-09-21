using System.Text.Json.Nodes;
using Application.Insights;
using Domain.Experiments;

namespace Application.UnitTests.Insights;

public class InsightParserTests
{
    private static readonly Guid EventId = Guid.Parse("11111111-1111-1111-1111-111111111111");
    private static readonly Guid EnvId = Guid.Parse("22222222-2222-2222-2222-222222222222");
    private static readonly DateTime EventTime = new(2026, 1, 1, 0, 0, 0, 123, DateTimeKind.Utc);

    [Fact]
    public void TryParse_Exposure_MapsFieldsAndConvertsMicrosecondTimestamp()
    {
        var before = DateTime.UtcNow;

        Assert.True(InsightParser.TryParse(Envelope("FlagValue", Exposure()).ToJsonString(), out var result));

        var exposure = Assert.IsType<ExperimentExposureEvent>(result);
        Assert.Equal(EventId, exposure.Id);
        Assert.Equal(EnvId, exposure.EnvId);
        Assert.Equal("flag-key", exposure.FlagKey);
        Assert.Equal("user-key", exposure.UserKey);
        Assert.Equal("variation-id", exposure.VariationId);
        Assert.Equal("true", exposure.VariationValue);
        Assert.Equal(EventTime, exposure.ExposedAt);
        Assert.Equal(DateTimeKind.Utc, exposure.ExposedAt.Kind);
        Assert.InRange(exposure.CreatedAt, before, DateTime.UtcNow);
        Assert.Equal(DateTimeKind.Utc, exposure.CreatedAt.Kind);
    }

    [Fact]
    public void TryParse_Metric_MapsFieldsAndConvertsMicrosecondTimestamp()
    {
        var before = DateTime.UtcNow;

        Assert.True(InsightParser.TryParse(Envelope("Custom", Metric()).ToJsonString(), out var result));

        var metric = Assert.IsType<ExperimentMetricEvent>(result);
        Assert.Equal(EventId, metric.Id);
        Assert.Equal(EnvId, metric.EnvId);
        Assert.Equal("user-key", metric.UserKey);
        Assert.Equal("purchase", metric.EventName);
        Assert.Equal("Custom", metric.EventType);
        Assert.Equal(1.23456789012345, metric.NumericValue);
        Assert.Equal("dotnet", metric.ApplicationType);
        Assert.Equal(EventTime, metric.OccurredAt);
        Assert.Equal(DateTimeKind.Utc, metric.OccurredAt.Kind);
        Assert.InRange(metric.CreatedAt, before, DateTime.UtcNow);
        Assert.Equal(DateTimeKind.Utc, metric.CreatedAt.Kind);
    }

    [Theory]
    [InlineData("featureFlagKey")]
    [InlineData("userKeyId")]
    [InlineData("variationId")]
    public void TryParse_ExposureMissingRequiredField_ReturnsFalse(string field)
    {
        var properties = Exposure();
        properties.Remove(field);
        AssertRejected(Envelope("FlagValue", properties).ToJsonString());
    }

    [Theory]
    [InlineData("user")]
    [InlineData("keyId")]
    [InlineData("eventName")]
    public void TryParse_MetricMissingRequiredField_ReturnsFalse(string field)
    {
        var properties = Metric();
        if (field == "keyId")
            properties["user"]!.AsObject().Remove(field);
        else
            properties.Remove(field);

        AssertRejected(Envelope("Custom", properties).ToJsonString());
    }

    [Theory]
    [InlineData("uuid", "\"invalid-guid\"")]
    [InlineData("env_id", "\"invalid-guid\"")]
    [InlineData("event", "\" \"")]
    [InlineData("timestamp", "null")]
    [InlineData("timestamp", "253402300800000000")]
    [InlineData("properties", "{}")]
    [InlineData("properties", "\"{\"")]
    public void TryParse_InvalidEnvelope_ReturnsFalse(string field, string value)
    {
        var message = Envelope("Custom", Metric());
        message[field] = JsonNode.Parse(value);
        AssertRejected(message.ToJsonString());
    }

    [Fact]
    public void TryParse_MalformedJson_ReturnsFalse()
    {
        AssertRejected("{");
    }

    private static void AssertRejected(string json)
    {
        Assert.False(InsightParser.TryParse(json, out var result));
        Assert.Null(result);
    }

    private static JsonObject Exposure() => new()
    {
        ["featureFlagKey"] = "flag-key",
        ["userKeyId"] = "user-key",
        ["variationId"] = "variation-id",
        ["variationValue"] = "true"
    };

    private static JsonObject Metric() => new()
    {
        ["user"] = new JsonObject { ["keyId"] = "user-key" },
        ["eventName"] = "purchase",
        ["numericValue"] = 1.23456789012345,
        ["applicationType"] = "dotnet"
    };

    private static JsonObject Envelope(string eventType, JsonObject properties) => new()
    {
        ["uuid"] = EventId.ToString(),
        ["env_id"] = EnvId.ToString(),
        ["event"] = eventType,
        ["properties"] = properties.ToJsonString(),
        ["timestamp"] = 1767225600123000L
    };
}
