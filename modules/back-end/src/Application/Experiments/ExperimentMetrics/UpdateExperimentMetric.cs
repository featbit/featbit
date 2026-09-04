namespace Application.Experiments.ExperimentMetrics;

public class UpdateExperimentMetric : IRequest<ExperimentMetricVm>
{
    public Guid EnvId { get; set; }

    public Guid Id { get; set; }

    public UpdateExperimentMetricRequest Request { get; set; }
}

public class UpdateExperimentMetricValidator : AbstractValidator<UpdateExperimentMetric>
{
    public UpdateExperimentMetricValidator()
    {
        RuleFor(x => x.Request)
            .NotNull()
            .SetValidator(new UpdateExperimentMetricRequestValidator());
    }
}

public class UpdateExperimentMetricHandler(IExperimentMetricService service, IMapper mapper)
    : IRequestHandler<UpdateExperimentMetric, ExperimentMetricVm>
{
    public async Task<ExperimentMetricVm> Handle(
        UpdateExperimentMetric request,
        CancellationToken cancellationToken)
    {
        var metric = await service.UpdateAsync(request.EnvId, request.Id, request.Request);
        return mapper.Map<ExperimentMetricVm>(metric);
    }
}
