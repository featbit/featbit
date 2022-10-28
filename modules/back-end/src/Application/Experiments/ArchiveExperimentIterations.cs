using Domain.Experiments;

namespace Application.Experiments;

public class ArchiveExperimentIterations: IRequest<bool>
{
    public Guid EnvId { get; set; }
    public Guid ExperimentId { get; set; }
}


public class ArchiveExperimentIterationsHandler : IRequestHandler<ArchiveExperimentIterations, bool>
{
    private readonly IExperimentService _service;

    public ArchiveExperimentIterationsHandler(IExperimentService service)
    {
        _service = service;
    }

    public async Task<bool> Handle(ArchiveExperimentIterations request, CancellationToken cancellationToken)
    {
        await _service.ArchiveIterations(request.EnvId, request.ExperimentId);
        return true;
    }
}