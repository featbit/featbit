using System.Text.Json;
using Application.Experiments;
using Domain.Experiments;

namespace Application.UnitTests.Experiments;

public class ExperimentMetricSnapshotRequestTests
{
    [Theory]
    [InlineData("""{"metricKey":"purchase","eventName":"purchase"}""")]
    [InlineData("""{"metricId":null,"metricKey":"purchase","eventName":"purchase"}""")]
    public void MetricSnapshots_RequireMetricId(string json)
    {
        var options = new JsonSerializerOptions(JsonSerializerDefaults.Web);

        Assert.Throws<JsonException>(() => JsonSerializer.Deserialize<PrimaryMetricConfig>(json, options));
        Assert.Throws<JsonException>(() => JsonSerializer.Deserialize<GuardrailMetricConfig>(json, options));
    }

    [Fact]
    public void MetricsUpdate_AcceptsUnknownFieldsAlongsideValidSelections()
    {
        var update = Deserialize("""
            {
                "metricEvent": "legacy-event",
                "primaryMetric": {
                    "metricId": "11111111-1111-4111-8111-111111111111",
                    "expectedDirection": "increase_good",
                    "eventName": "extra-primary-event"
                },
                "guardrailMetrics": [{
                    "metricId": "22222222-2222-4222-8222-222222222222",
                    "direction": "decrease_bad",
                    "eventName": "extra-guardrail-event"
                }]
            }
            """);

        Assert.True(Validate(update).IsValid);
        Assert.Equal(Guid.Parse("11111111-1111-4111-8111-111111111111"), update.PrimaryMetric.MetricId);
        Assert.Equal("increase_good", update.PrimaryMetric.ExpectedDirection);
        var guardrail = Assert.Single(update.GuardrailMetrics);
        Assert.Equal(Guid.Parse("22222222-2222-4222-8222-222222222222"), guardrail.MetricId);
        Assert.Equal("decrease_bad", guardrail.Direction);
    }

    [Theory]
    [InlineData("increase_good", "increase_bad")]
    [InlineData("decrease_good", "decrease_bad")]
    public void MetricsUpdate_AcceptsTypedSelections(string expectedDirection, string direction)
    {
        var json = $$"""{"primaryMetric":{"metricId":"11111111-1111-4111-8111-111111111111","expectedDirection":"{{expectedDirection}}"},"guardrailMetrics":[{"metricId":"22222222-2222-4222-8222-222222222222","direction":"{{direction}}"}]}""";
        var update = Deserialize(json);

        Assert.True(Validate(update).IsValid);
        Assert.Equal(expectedDirection, update.PrimaryMetric.ExpectedDirection);
        Assert.Equal(direction, Assert.Single(update.GuardrailMetrics).Direction);
    }

    [Fact]
    public void MetricsUpdate_OmittedGuardrails_DefaultToEmptyList()
    {
        var update = Deserialize("""{"primaryMetric":{"metricId":"11111111-1111-4111-8111-111111111111","expectedDirection":"increase_good"}}""");
        Assert.True(Validate(update).IsValid);
        Assert.Empty(update.GuardrailMetrics);
    }

    [Theory]
    [InlineData("null", "Update.PrimaryMetric", "primaryMetric_is_required")]
    [InlineData("{}", "Update.PrimaryMetric.MetricId", "primaryMetric.metricId_is_required")]
    [InlineData("{}", "Update.PrimaryMetric.ExpectedDirection", "primaryMetric.expectedDirection_is_required")]
    [InlineData("""{"metricId":"00000000-0000-0000-0000-000000000000","expectedDirection":"increase_good"}""",
        "Update.PrimaryMetric.MetricId", "primaryMetric.metricId_is_required")]
    [InlineData("""{"metricId":"11111111-1111-4111-8111-111111111111"}""",
        "Update.PrimaryMetric.ExpectedDirection", "primaryMetric.expectedDirection_is_required")]
    [InlineData("""{"metricId":"11111111-1111-4111-8111-111111111111","expectedDirection":"increase_bad"}""",
        "Update.PrimaryMetric.ExpectedDirection", "primaryMetric.expectedDirection_is_invalid")]
    public void MetricsUpdate_RejectsInvalidPrimarySelection(string selection, string property, string errorCode)
    {
        var update = Deserialize($"{{\"primaryMetric\":{selection}}}");
        Assert.Contains(Validate(update).Errors,
            error => error.PropertyName == property && error.ErrorCode == errorCode);
    }

    [Theory]
    [InlineData("null", "Update.GuardrailMetrics", "guardrailMetrics_is_required")]
    [InlineData("[null]", "Update.GuardrailMetrics[0]", "guardrailMetrics_is_invalid")]
    [InlineData("[{}]", "Update.GuardrailMetrics[0].MetricId", "guardrailMetrics.metricId_is_required")]
    [InlineData("[{}]", "Update.GuardrailMetrics[0].Direction", "guardrailMetrics.direction_is_required")]
    [InlineData("""[{"metricId":"00000000-0000-0000-0000-000000000000","direction":"increase_bad"}]""",
        "Update.GuardrailMetrics[0].MetricId", "guardrailMetrics.metricId_is_required")]
    [InlineData("""[{"metricId":"22222222-2222-4222-8222-222222222222"}]""",
        "Update.GuardrailMetrics[0].Direction", "guardrailMetrics.direction_is_required")]
    [InlineData("""[{"metricId":"22222222-2222-4222-8222-222222222222","direction":"increase_good"}]""",
        "Update.GuardrailMetrics[0].Direction", "guardrailMetrics.direction_is_invalid")]
    public void MetricsUpdate_RejectsInvalidGuardrailSelection(string selections, string property, string errorCode)
    {
        var json = $$"""{"primaryMetric":{"metricId":"11111111-1111-4111-8111-111111111111","expectedDirection":"increase_good"},"guardrailMetrics":{{selections}}}""";
        Assert.Contains(Validate(Deserialize(json)).Errors,
            error => error.PropertyName == property && error.ErrorCode == errorCode);
    }

    [Fact]
    public void MetricsUpdate_RejectsGuardrailsEncodedAsString()
    {
        Assert.Throws<JsonException>(() => Deserialize("""{"guardrailMetrics":"[]"}"""));
    }

    private static ExperimentMetricsUpdate Deserialize(string json) =>
        JsonSerializer.Deserialize<ExperimentMetricsUpdate>(json,
            new JsonSerializerOptions(JsonSerializerDefaults.Web))!;

    private static FluentValidation.Results.ValidationResult Validate(ExperimentMetricsUpdate update) =>
        new UpdateExperimentMetricsValidator().Validate(new UpdateExperimentMetrics { Update = update });

    [Theory]
    [InlineData("primaryMetric", "{}")]
    [InlineData("guardrailMetrics", "[]")]
    [InlineData("primaryMetricEvent", "\"replacement\"")]
    [InlineData("primaryMetricType", "\"numeric\"")]
    [InlineData("primaryMetricAgg", "\"sum\"")]
    [InlineData("guardrailEvents", "\"[]\"")]
    public void RunUpdate_RejectsMetricSnapshotChanges(string property, string value)
    {
        var json = $"{{\"{property}\":{value}}}";
        Assert.Throws<JsonException>(() => JsonSerializer.Deserialize<ExperimentRunUpdate>(json,
            new JsonSerializerOptions(JsonSerializerDefaults.Web)));
    }
}
