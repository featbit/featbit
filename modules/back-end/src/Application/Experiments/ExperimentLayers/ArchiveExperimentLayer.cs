using Application.Bases;

namespace Application.Experiments.ExperimentLayers;

public class ArchiveExperimentLayer : IRequest<bool>
{
    public Guid EnvId { get; set; }

    public Guid Id { get; set; }
}

public class ArchiveExperimentLayerHandler(IExperimentLayerService service)
    : IRequestHandler<ArchiveExperimentLayer, bool>
{
    public async Task<bool> Handle(ArchiveExperimentLayer request, CancellationToken cancellationToken)
    {
        await service.ArchiveAsync(request.EnvId, request.Id);
        return true;
    }
}
