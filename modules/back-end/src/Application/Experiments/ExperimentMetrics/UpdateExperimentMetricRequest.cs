using System.Text.Json;
using System.Text.Json.Serialization;
using Application.Bases;

namespace Application.Experiments.ExperimentMetrics;

public class UpdateExperimentMetricRequest
{
    public string Name { get; set; }

    public string Description { get; set; }

    public string MetricType { get; set; } = "binary";

    public string MetricAgg { get; set; } = "once";

    [JsonExtensionData]
    public IDictionary<string, JsonElement> AdditionalProperties { get; set; }
}

public class UpdateExperimentMetricRequestValidator : AbstractValidator<UpdateExperimentMetricRequest>
{
    private static readonly string[] MetricTypes = ["binary", "numeric"];
    private static readonly string[] MetricAggs = ["once", "count", "sum", "average"];

    public UpdateExperimentMetricRequestValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty().WithErrorCode(ErrorCodes.Required("name"))
            .MaximumLength(256).WithErrorCode(ErrorCodes.Invalid("name"));

        RuleFor(x => x.MetricType)
            .Must(value => MetricTypes.Contains(value))
            .WithErrorCode(ErrorCodes.Invalid("metricType"));

        RuleFor(x => x.MetricAgg)
            .Must(value => MetricAggs.Contains(value))
            .WithErrorCode(ErrorCodes.Invalid("metricAgg"));

        RuleFor(x => x.AdditionalProperties)
            .Must(NotContainImmutableFields)
            .WithErrorCode(ErrorCodes.Invalid("request"))
            .WithMessage("Metric key and status can only be changed through their dedicated lifecycle operations.");
    }

    private static bool NotContainImmutableFields(IDictionary<string, JsonElement> properties)
    {
        return properties == null || properties.Keys.All(
            key => !string.Equals(key, "key", StringComparison.OrdinalIgnoreCase) &&
                   !string.Equals(key, "status", StringComparison.OrdinalIgnoreCase));
    }
}
