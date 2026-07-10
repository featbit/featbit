using Application.Bases;
using Application.ExperimentMetrics;
using Domain.ExperimentMetrics;

namespace Application.UnitTests.Validators;

public class ExperimentMetricValidatorTests
{
    private static CreateExperimentMetric ValidCreate() => new()
    {
        Name = "metric",
        EventType = EventType.Custom,
        MaintainerUserId = Guid.NewGuid()
    };

    [Fact]
    public void CreateExperimentMetric_AllFieldsValid_NoErrors()
    {
        var result = new CreateExperimentMetricValidator().Validate(ValidCreate());

        Assert.True(result.IsValid);
    }

    [Fact]
    public void CreateExperimentMetric_EmptyName_NameRequiredError()
    {
        var request = ValidCreate();
        request.Name = string.Empty;

        var result = new CreateExperimentMetricValidator().Validate(request);

        Assert.Contains(result.Errors, e => e.ErrorCode == ErrorCodes.Required("name"));
    }

    [Fact]
    public void CreateExperimentMetric_EmptyMaintainer_MaintainerUserIdRequiredError()
    {
        var request = ValidCreate();
        request.MaintainerUserId = Guid.Empty;

        var result = new CreateExperimentMetricValidator().Validate(request);

        Assert.Contains(result.Errors, e => e.ErrorCode == ErrorCodes.Required("maintainerUserId"));
    }

    [Fact]
    public void UpdateExperimentMetric_AllFieldsValid_NoErrors()
    {
        var request = new UpdateExperimentMetric
        {
            Name = "n",
            EventName = "ev",
            EventType = EventType.Custom,
            MaintainerUserId = Guid.NewGuid()
        };

        var result = new UpdateExperimentMetricValidator().Validate(request);

        Assert.True(result.IsValid);
    }

    [Theory]
    [InlineData("", "ev", "name")]
    [InlineData("n", "", "eventName")]
    public void UpdateExperimentMetric_EmptyRequired_RequiredError(string name, string eventName, string field)
    {
        var request = new UpdateExperimentMetric
        {
            Name = name,
            EventName = eventName,
            EventType = EventType.Custom,
            MaintainerUserId = Guid.NewGuid()
        };

        var result = new UpdateExperimentMetricValidator().Validate(request);

        Assert.Contains(result.Errors, e => e.ErrorCode == ErrorCodes.Required(field));
    }
}
