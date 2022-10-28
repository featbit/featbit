using Domain.Experiments;

namespace Application.Experiments;

public class ArchiveExperiment: IRequest<bool>
{
    public Guid EnvId { get; set; }
    public Guid ExperimentId { get; set; }
}


public class ArchiveExperimentHandler : IRequestHandler<ArchiveExperiment, bool>
{
    private readonly IExperimentService _service;

    public ArchiveExperimentHandler(IExperimentService service)
    {
        _service = service;
    }

    public async Task<bool> Handle(ArchiveExperiment request, CancellationToken cancellationToken)
    {
        await _service.ArchiveExperiment(request.EnvId, request.ExperimentId);
        return true;
    }
}