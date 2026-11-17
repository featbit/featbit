using Application.Bases;

namespace Application.Experiments;

public class ExperimentMetricsUpdate
{
    public PrimaryMetricSelection PrimaryMetric { get; set; }

    public List<GuardrailMetricSelection> GuardrailMetrics { get; set; } = [];
}

public class PrimaryMetricSelection
{
    public Guid MetricId { get; set; }

    public string ExpectedDirection { get; set; }
}

public class GuardrailMetricSelection
{
    public Guid MetricId { get; set; }

    public string Direction { get; set; }
}

public class UpdateExperimentMetrics : IRequest<ExperimentDetailVm>
{
    public Guid EnvId { get; set; }

    public Guid Id { get; set; }

    public ExperimentMetricsUpdate Update { get; set; }
}

public class UpdateExperimentMetricsValidator : AbstractValidator<UpdateExperimentMetrics>
{
    private static readonly string[] ExpectedDirections = ["increase_good", "decrease_good"];
    private static readonly string[] GuardrailDirections = ["increase_bad", "decrease_bad"];

    public UpdateExperimentMetricsValidator()
    {
        RuleFor(x => x.Update)
            .NotNull().WithErrorCode(ErrorCodes.Required("update"));

        When(x => x.Update != null, () =>
        {
            RuleFor(x => x.Update.PrimaryMetric)
                .NotNull().WithErrorCode(ErrorCodes.Required("primaryMetric"));

            When(x => x.Update.PrimaryMetric != null, () =>
            {
                RuleFor(x => x.Update.PrimaryMetric.MetricId)
                    .NotEmpty().WithErrorCode(ErrorCodes.Required("primaryMetric.metricId"));

                RuleFor(x => x.Update.PrimaryMetric.ExpectedDirection)
                    .Cascade(CascadeMode.Stop)
                    .NotEmpty().WithErrorCode(ErrorCodes.Required("primaryMetric.expectedDirection"))
                    .Must(value => ExpectedDirections.Contains(value))
                    .WithErrorCode(ErrorCodes.Invalid("primaryMetric.expectedDirection"))
                    .WithMessage("Expected direction must be either increase_good or decrease_good.");
            });

            RuleFor(x => x.Update.GuardrailMetrics)
                .NotNull().WithErrorCode(ErrorCodes.Required("guardrailMetrics"));

            RuleForEach(x => x.Update.GuardrailMetrics)
                .NotNull().WithErrorCode(ErrorCodes.Invalid("guardrailMetrics"))
                .ChildRules(guardrail =>
                {
                    guardrail.RuleFor(x => x.MetricId)
                        .NotEmpty().WithErrorCode(ErrorCodes.Required("guardrailMetrics.metricId"));

                    guardrail.RuleFor(x => x.Direction)
                        .Cascade(CascadeMode.Stop)
                        .NotEmpty().WithErrorCode(ErrorCodes.Required("guardrailMetrics.direction"))
                        .Must(value => GuardrailDirections.Contains(value))
                        .WithErrorCode(ErrorCodes.Invalid("guardrailMetrics.direction"))
                        .WithMessage("Guardrail direction must be either increase_bad or decrease_bad.");
                });
        });
    }
}

public class UpdateExperimentMetricsHandler(
    IExperimentService service)
    : IRequestHandler<UpdateExperimentMetrics, ExperimentDetailVm>
{
    public async Task<ExperimentDetailVm> Handle(
        UpdateExperimentMetrics request,
        CancellationToken cancellationToken)
    {
        return await service.UpdateMetricsAsync(request.EnvId, request.Id, request.Update);
    }
}
