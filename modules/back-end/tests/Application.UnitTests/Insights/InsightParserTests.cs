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
    public void TryParse_Exposure_MapsAllStoredFields()
    {
        var message = Exposure();
        var before = DateTime.UtcNow;

        Assert.True(InsightParser.TryParse(message.ToJsonString(), out var result));

        var actual = Assert.IsType<ExperimentExposureEvent>(result);
        Assert.Equal(EventId, actual.Id);
        Assert.Equal(EnvId, actual.EnvId);
        Assert.Equal("flag-key", actual.FlagKey);
        Assert.Equal("user-key", actual.UserKey);
        Assert.Equal("variation-id", actual.VariationId);
        Assert.Equal("true", actual.VariationValue);
        Assert.Equal(EventTime, actual.ExposedAt);
        Assert.Equal(DateTimeKind.Utc, actual.ExposedAt.Kind);
        Assert.InRange(actual.CreatedAt, before, DateTime.UtcNow);
        Assert.Equal(DateTimeKind.Utc, actual.CreatedAt.Kind);
    }

    [Fact]
    public void TryParse_Metric_MapsAllStoredFields()
    {
        var message = Metric();
        var before = DateTime.UtcNow;

        Assert.True(InsightParser.TryParse(message.ToJsonString(), out var result));

        var actual = Assert.IsType<ExperimentMetricEvent>(result);
        Assert.Equal(EventId, actual.Id);
        Assert.Equal(EnvId, actual.EnvId);
        Assert.Equal("user-key", actual.UserKey);
        Assert.Equal("purchase", actual.EventName);
        Assert.Equal("Custom", actual.EventType);
        Assert.Equal(1.23456789012345, actual.NumericValue);
        Assert.Equal("dotnet-server-side", actual.ApplicationType);
        Assert.Equal(EventTime, actual.OccurredAt);
        Assert.Equal(DateTimeKind.Utc, actual.OccurredAt.Kind);
        Assert.InRange(actual.CreatedAt, before, DateTime.UtcNow);
        Assert.Equal(DateTimeKind.Utc, actual.CreatedAt.Kind);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("null")]
    [InlineData("\"\"")]
    public void TryParse_OptionalVariationValue_PreservesNullOrEmpty(string? value)
    {
        var message = Exposure();
        SetOrRemove(message["properties"]!.AsObject(), "variationValue", value);

        Assert.True(InsightParser.TryParse(message.ToJsonString(), out var result));
        Assert.Equal(value == "\"\"" ? "" : null,
            Assert.IsType<ExperimentExposureEvent>(result).VariationValue);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("null")]
    [InlineData("\"not-a-number\"")]
    [InlineData("true")]
    public void TryParse_MissingOrNonNumericMetricValue_DefaultsToZero(string? value)
    {
        var message = Metric();
        SetOrRemove(message["properties"]!.AsObject(), "numericValue", value);
        message["properties"]!.AsObject().Remove("applicationType");

        Assert.True(InsightParser.TryParse(message.ToJsonString(), out var result));
        var actual = Assert.IsType<ExperimentMetricEvent>(result);
        Assert.Equal(0, actual.NumericValue);
        Assert.Null(actual.ApplicationType);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-2.5)]
    public void TryParse_ZeroOrNegativeMetricValue_PreservesValue(double value)
    {
        var message = Metric();
        message["properties"]!["numericValue"] = value;

        Assert.True(InsightParser.TryParse(message.ToJsonString(), out var result));
        Assert.Equal(value, Assert.IsType<ExperimentMetricEvent>(result).NumericValue);
    }

    [Theory]
    [InlineData("")]
    [InlineData("{")]
    [InlineData("null")]
    [InlineData("[]")]
    [InlineData("42")]
    public void TryParse_InvalidDocument_ReturnsFalseWithoutThrowing(string json)
    {
        AssertRejected(json);
    }

    [Theory]
    [InlineData("schema_version", null)]
    [InlineData("schema_version", "null")]
    [InlineData("schema_version", "1")]
    [InlineData("schema_version", "3")]
    [InlineData("schema_version", "2.5")]
    [InlineData("schema_version", "\"2\"")]
    [InlineData("uuid", null)]
    [InlineData("uuid", "\"invalid-guid\"")]
    [InlineData("env_id", null)]
    [InlineData("env_id", "\"invalid-guid\"")]
    [InlineData("event", null)]
    [InlineData("event", "null")]
    [InlineData("event", "\" \\t\"")]
    [InlineData("event", "123")]
    [InlineData("timestamp", null)]
    [InlineData("timestamp", "\"1767225600123\"")]
    [InlineData("timestamp", "1.5")]
    [InlineData("timestamp", "253402300800000")]
    [InlineData("timestamp", "-62135596800001")]
    [InlineData("properties", null)]
    [InlineData("properties", "null")]
    [InlineData("properties", "[]")]
    [InlineData("properties", "\"{}\"")]
    public void TryParse_InvalidEnvelope_ReturnsFalseWithoutThrowing(string field, string? value)
    {
        var message = Metric();
        SetOrRemove(message, field, value);
        AssertRejected(message.ToJsonString());
    }

    [Theory]
    [InlineData("FlagValue", "featureFlagKey")]
    [InlineData("FlagValue", "userKeyId")]
    [InlineData("FlagValue", "variationId")]
    [InlineData("Custom", "userKeyId")]
    [InlineData("Custom", "eventName")]
    public void TryParse_InvalidRequiredProperty_RejectsEvent(string eventType, string field)
    {
        foreach (var value in new string?[] { null, "null", "\"\"", "\" \"", "123" })
        {
            var message = eventType == "FlagValue" ? Exposure() : Metric();
            SetOrRemove(message["properties"]!.AsObject(), field, value);
            AssertRejected(message.ToJsonString());
        }
    }

    [Fact]
    public void TryParse_MetricPayloadWithExposureEventType_IsRejected()
    {
        var message = Metric();
        message["event"] = "FlagValue";
        AssertRejected(message.ToJsonString());
    }

    private static void AssertRejected(string json)
    {
        Assert.False(InsightParser.TryParse(json, out var result));
        Assert.Null(result);
    }

    // A null argument removes the field; the JSON text "null" keeps an explicit null value.
    private static void SetOrRemove(JsonObject target, string field, string? json)
    {
        if (json is null)
        {
            target.Remove(field);
        }
        else
        {
            target[field] = JsonNode.Parse(json);
        }
    }

    private static JsonObject Exposure() => Envelope("FlagValue", new JsonObject
    {
        ["featureFlagKey"] = "flag-key",
        ["userKeyId"] = "user-key",
        ["userName"] = "User",
        ["variationId"] = "variation-id",
        ["variationValue"] = "true"
    });

    private static JsonObject Metric() => Envelope("Custom", new JsonObject
    {
        ["userKeyId"] = "user-key",
        ["eventName"] = "purchase",
        ["numericValue"] = 1.23456789012345,
        ["applicationType"] = "dotnet-server-side"
    });

    private static JsonObject Envelope(string eventType, JsonObject properties) => new()
    {
        ["schema_version"] = 2,
        ["uuid"] = EventId.ToString(),
        ["env_id"] = EnvId.ToString(),
        ["event"] = eventType,
        ["properties"] = properties,
        ["timestamp"] = 1767225600123L
    };
}
