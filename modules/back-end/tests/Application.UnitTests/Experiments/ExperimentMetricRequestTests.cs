using System.Text.Json;
using Application.Experiments.ExperimentMetrics;

namespace Application.UnitTests.Experiments;

public class ExperimentMetricRequestTests
{
    [Fact]
    public void UpdateRequest_DoesNotExposeKeyOrStatus()
    {
        Assert.Null(typeof(UpdateExperimentMetricRequest).GetProperty("Key"));
        Assert.Null(typeof(UpdateExperimentMetricRequest).GetProperty("Status"));
    }

    [Fact]
    public void CreateRequest_DoesNotExposeStatus()
    {
        Assert.NotNull(typeof(CreateExperimentMetricRequest).GetProperty("Key"));
        Assert.Null(typeof(CreateExperimentMetricRequest).GetProperty("Status"));
    }

    [Fact]
    public void CatalogWriteValidators_AcceptNumericAndRejectContinuousMetricType()
    {
        var createRequest = new CreateExperimentMetricRequest
        {
            Name = "Revenue",
            Key = "revenue",
            MetricType = "numeric",
            MetricAgg = "sum"
        };
        var updateRequest = new UpdateExperimentMetricRequest
        {
            Name = "Revenue",
            MetricType = "numeric",
            MetricAgg = "sum"
        };
        var continuousCreateRequest = new CreateExperimentMetricRequest
        {
            Name = "Revenue",
            Key = "revenue",
            MetricType = "continuous",
            MetricAgg = "sum"
        };
        var continuousUpdateRequest = new UpdateExperimentMetricRequest
        {
            Name = "Revenue",
            MetricType = "continuous",
            MetricAgg = "sum"
        };

        Assert.True(new CreateExperimentMetricRequestValidator().Validate(createRequest).IsValid);
        Assert.True(new UpdateExperimentMetricRequestValidator().Validate(updateRequest).IsValid);
        Assert.Contains(
            new CreateExperimentMetricRequestValidator().Validate(continuousCreateRequest).Errors,
            error => error.PropertyName == nameof(continuousCreateRequest.MetricType));
        Assert.Contains(
            new UpdateExperimentMetricRequestValidator().Validate(continuousUpdateRequest).Errors,
            error => error.PropertyName == nameof(continuousUpdateRequest.MetricType));
    }

    [Theory]
    [InlineData("key")]
    [InlineData("Key")]
    [InlineData("status")]
    [InlineData("STATUS")]
    public void UpdateValidator_RejectsImmutableFields(string field)
    {
        using var document = JsonDocument.Parse("\"value\"");
        var request = new UpdateExperimentMetricRequest
        {
            Name = "Checkout conversion",
            MetricType = "binary",
            MetricAgg = "once",
            AdditionalProperties = new Dictionary<string, JsonElement>
            {
                [field] = document.RootElement.Clone()
            }
        };

        var result = new UpdateExperimentMetricRequestValidator().Validate(request);

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, error => error.PropertyName == nameof(request.AdditionalProperties));
    }

    [Fact]
    public void UpdateCommandValidator_ValidatesNestedRequest()
    {
        using var document = JsonDocument.Parse("\"archived\"");
        var command = new UpdateExperimentMetric
        {
            EnvId = Guid.NewGuid(),
            Id = Guid.NewGuid(),
            Request = new UpdateExperimentMetricRequest
            {
                Name = "Checkout conversion",
                MetricType = "binary",
                MetricAgg = "once",
                AdditionalProperties = new Dictionary<string, JsonElement>
                {
                    ["status"] = document.RootElement.Clone()
                }
            }
        };

        var result = new UpdateExperimentMetricValidator().Validate(command);

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, error => error.PropertyName.EndsWith("AdditionalProperties"));
    }
}
