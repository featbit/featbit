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

    [Theory]
    [InlineData("metricId")]
    [InlineData("metricKey")]
    [InlineData("expectedDirection")]
    [InlineData("metricEvent")]
    [InlineData("metricName")]
    [InlineData("metricType")]
    [InlineData("metricAgg")]
    [InlineData("metricDescription")]
    [InlineData("guardrails")]
    public void MetricsUpdate_IgnoresUnmappedFields(string property)
    {
        var json = $$"""{"primaryMetric":{"metricId":"11111111-1111-4111-8111-111111111111","expectedDirection":"increase_good"},"{{property}}":"purchase"}""";

        var update = Deserialize(json);
        Assert.True(Validate(update).IsValid);
        Assert.Equal(Guid.Parse("11111111-1111-4111-8111-111111111111"), update.PrimaryMetric.MetricId);
    }

    [Theory]
    [InlineData("primaryMetric", "metricKey")]
    [InlineData("primaryMetric", "eventName")]
    [InlineData("guardrailMetrics", "metricKey")]
    [InlineData("guardrailMetrics", "eventName")]
    public void MetricsUpdate_IgnoresUnmappedSelectionFields(string field, string property)
    {
        var selection = $$"""{"metricId":"11111111-1111-4111-8111-111111111111","{{property}}":"purchase"}""";
        var value = field == "guardrailMetrics" ? $"[{selection}]" : selection;
        var update = Deserialize($"{{\"{field}\":{value}}}");
        var metricId = field == "guardrailMetrics"
            ? Assert.Single(update.GuardrailMetrics).MetricId
            : update.PrimaryMetric.MetricId;
        Assert.Equal(Guid.Parse("11111111-1111-4111-8111-111111111111"), metricId);
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
    [InlineData("null")]
    [InlineData("{}")]
    [InlineData("{\"metricId\":\"00000000-0000-0000-0000-000000000000\",\"expectedDirection\":\"increase_good\"}")]
    [InlineData("{\"metricId\":\"11111111-1111-4111-8111-111111111111\"}")]
    [InlineData("{\"metricId\":\"11111111-1111-4111-8111-111111111111\",\"expectedDirection\":\"increase_bad\"}")]
    public void MetricsUpdate_RejectsInvalidPrimarySelection(string selection)
    {
        var update = Deserialize($"{{\"primaryMetric\":{selection}}}");
        Assert.False(Validate(update).IsValid);
    }

    [Theory]
    [InlineData("null")]
    [InlineData("[null]")]
    [InlineData("[{}]")]
    [InlineData("[{\"metricId\":\"00000000-0000-0000-0000-000000000000\",\"direction\":\"increase_bad\"}]")]
    [InlineData("[{\"metricId\":\"22222222-2222-4222-8222-222222222222\"}]")]
    [InlineData("[{\"metricId\":\"22222222-2222-4222-8222-222222222222\",\"direction\":\"increase_good\"}]")]
    public void MetricsUpdate_RejectsInvalidGuardrailSelection(string selections)
    {
        var json = $$"""{"primaryMetric":{"metricId":"11111111-1111-4111-8111-111111111111","expectedDirection":"increase_good"},"guardrailMetrics":{{selections}}}""";
        Assert.False(Validate(Deserialize(json)).IsValid);
    }

    [Theory]
    [InlineData("{\"guardrailMetrics\":\"[]\"}")]
    [InlineData("{\"primaryMetric\":{\"metricId\":\"invalid\"}}")]
    [InlineData("{\"guardrailMetrics\":[{\"metricId\":\"invalid\"}]}")]
    public void MetricsUpdate_RejectsWrongJsonTypes(string json)
    {
        Assert.Throws<JsonException>(() => Deserialize(json));
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

    [Fact]
    public void RunUpdate_StillAcceptsAnalysisSettings()
    {
        var update = JsonSerializer.Deserialize<ExperimentRunUpdate>("""{"minimumSample":100,"decision":"CONTINUE"}""",
            new JsonSerializerOptions(JsonSerializerDefaults.Web));
        Assert.Equal(100, update!.MinimumSample);
        Assert.Equal("CONTINUE", update.Decision);
    }
}
