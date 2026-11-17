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

public class CreateExperimentMetricHandler(IExperimentMetricService service, IMapper mapper)
    : IRequestHandler<CreateExperimentMetric, ExperimentMetricVm>
{
    public async Task<ExperimentMetricVm> Handle(
        CreateExperimentMetric request,
        CancellationToken cancellationToken)
    {
        var metric = await service.CreateAsync(request.EnvId, request.Request);
        return mapper.Map<ExperimentMetricVm>(metric);
    }
}
