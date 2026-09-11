using Application.Bases;

namespace Application.Experiments.ExperimentLayers;

public class RestoreExperimentLayer : IRequest<bool>
{
    public Guid EnvId { get; set; }

    public Guid Id { get; set; }
}

public class RestoreExperimentLayerHandler(IExperimentLayerService service)
    : IRequestHandler<RestoreExperimentLayer, bool>
{
    public async Task<bool> Handle(RestoreExperimentLayer request, CancellationToken cancellationToken)
    {
        await service.RestoreAsync(request.EnvId, request.Id);
        return true;
    }
}
