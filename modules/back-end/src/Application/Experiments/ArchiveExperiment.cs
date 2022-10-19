namespace Application.Experiments;

public class ArchiveExperimentMetric : IRequest<bool>
{
    public Guid Id { get; set; }
}

public class ArchiveExperimentMetricHandler : IRequestHandler<ArchiveExperimentMetric, bool>
{
    private readonly IExperimentMetricService _service;

    public ArchiveExperimentMetricHandler(IExperimentMetricService service)
    {
        _service = service;
    }
    
    public async Task<bool> Handle(ArchiveExperimentMetric request, CancellationToken cancellationToken)
    {
        var em = await _service.GetAsync(request.Id);
        em.UpdatedAt = DateTime.UtcNow;
        em.IsArvhived = true;
        await _service.UpdateAsync(em);

        return true;
    }
}