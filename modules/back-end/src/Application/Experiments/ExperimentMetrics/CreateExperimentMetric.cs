namespace Application.Experiments.ExperimentMetrics;

public class CreateExperimentMetric : IRequest<ExperimentMetricVm>
{
    public Guid EnvId { get; set; }

    public CreateExperimentMetricRequest Request { get; set; }
}

public class CreateExperimentMetricValidator : AbstractValidator<CreateExperimentMetric>
{
    public CreateExperimentMetricValidator()
    {
        RuleFor(x => x.Request)
            .NotNull()
            .SetValidator(new CreateExperimentMetricRequestValidator());
    }
}

public class CreateExperimentMetricHandler(IExperimentMetricService service)
    : IRequestHandler<CreateExperimentMetric, ExperimentMetricVm>
{
    public async ValueTask<ExperimentMetricVm> Handle(
        CreateExperimentMetric request,
        CancellationToken cancellationToken)
    {
        var metric = await service.CreateAsync(request.EnvId, request.Request);
        return ExperimentMetricMapper.ToVm(metric);
    }
}
