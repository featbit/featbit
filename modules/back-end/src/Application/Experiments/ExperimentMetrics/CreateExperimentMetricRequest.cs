using Application.Bases;

namespace Application.Experiments.ExperimentMetrics;

public class CreateExperimentMetricRequest
{
    public string Name { get; set; }

    public string Key { get; set; }

    public string Description { get; set; }

    public string MetricType { get; set; } = "binary";

    public string MetricAgg { get; set; } = "once";
}

public class CreateExperimentMetricRequestValidator : AbstractValidator<CreateExperimentMetricRequest>
{
    private static readonly string[] MetricTypes = ["binary", "numeric"];
    private static readonly string[] MetricAggs = ["once", "count", "sum", "average"];

    public CreateExperimentMetricRequestValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty().WithErrorCode(ErrorCodes.Required("name"))
            .MaximumLength(256).WithErrorCode(ErrorCodes.Invalid("name"));

        RuleFor(x => x.Key)
            .NotEmpty().WithErrorCode(ErrorCodes.Required("key"))
            .MaximumLength(128).WithErrorCode(ErrorCodes.Invalid("key"))
            .Matches("^[A-Za-z0-9][A-Za-z0-9_.:-]*$")
            .WithErrorCode(ErrorCodes.Invalid("key"));

        RuleFor(x => x.MetricType)
            .Must(value => MetricTypes.Contains(value))
            .WithErrorCode(ErrorCodes.Invalid("metricType"));

        RuleFor(x => x.MetricAgg)
            .Must(value => MetricAggs.Contains(value))
            .WithErrorCode(ErrorCodes.Invalid("metricAgg"));
    }
}
