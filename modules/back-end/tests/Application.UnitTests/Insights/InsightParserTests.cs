using Application.Insights;
using Domain.Experiments;

namespace Application.UnitTests.Insights;

public class InsightParserTests
{
    private readonly InsightParser _sut = new();

    [Fact]
    public void TryParse_ValidExposure_ReturnsExposureEvent()
    {
        var success = InsightParser.TryParse(CreateEvent(
            "FlagValue",
            "{\"featureFlagKey\":\"flag-key\",\"userKeyId\":\"user-key\",\"variationId\":\"variation-id\"}"),
            out var actual);

        Assert.True(success);
        Assert.IsType<ExperimentExposureEvent>(actual);
    }

    [Fact]
    public void TryParse_ValidMetric_ReturnsMetricEvent()
    {
        var success = InsightParser.TryParse(CreateEvent(
            "Custom",
            "{\"userKeyId\":\"user-key\",\"eventName\":\"metric-name\",\"numericValue\":1}"),
            out var actual);

        Assert.True(success);
        Assert.IsType<ExperimentMetricEvent>(actual);
    }

    [Theory]
    [InlineData("FlagValue", "{\"featureFlagKey\":\"flag-key\",\"userKeyId\":\"user-key\"}")]
    [InlineData("", "{\"userKeyId\":\"user-key\",\"eventName\":\"metric-name\"}")]
    public void TryParse_InvalidDomainEvent_ReturnsFalse(string eventType, string properties)
    {
        var success = InsightParser.TryParse(CreateEvent(eventType, properties), out var actual);

        Assert.False(success);
        Assert.Null(actual);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("0")]
    [InlineData("1")]
    [InlineData("3")]
    [InlineData("\"2\"")]
    [InlineData("null")]
    public void TryParse_UnsupportedSchemaVersion_ReturnsFalse(string? version)
    {
        var json = CreateEvent("FlagValue",
            "{\"featureFlagKey\":\"flag-key\",\"userKeyId\":\"user-key\",\"variationId\":\"variation-id\"}");
        json = json.Replace("\"schema_version\": 2,",
            version == null ? "" : $"\"schema_version\": {version},");

        Assert.False(InsightParser.TryParse(json, out var actual));
        Assert.Null(actual);
    }

    private static string CreateEvent(string eventType, string properties)
    {
        var escapedProperties = properties.Replace("\"", "\\\"");
        return $$"""
                 {
                   "schema_version": 2,
                   "uuid": "11111111-1111-1111-1111-111111111111",
                   "env_id": "22222222-2222-2222-2222-222222222222",
                   "event": "{{eventType}}",
                   "properties": "{{escapedProperties}}",
                   "timestamp": 1767225600000
                 }
                 """;
    }
}
