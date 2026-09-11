using Application.Bases;

namespace Application.Experiments.ExperimentLayers;

public class UpdateExperimentLayer : IRequest<ExperimentLayerVm>
{
    public Guid EnvId { get; set; }

    public Guid Id { get; set; }

    public UpdateExperimentLayerRequest Request { get; set; }
}

public class UpdateExperimentLayerHandler(IExperimentLayerService service, IMapper mapper)
    : IRequestHandler<UpdateExperimentLayer, ExperimentLayerVm>
{
    public async Task<ExperimentLayerVm> Handle(
        UpdateExperimentLayer request,
        CancellationToken cancellationToken)
    {
        var layer = await service.UpdateAsync(request.EnvId, request.Id, request.Request);
        return mapper.Map<ExperimentLayerVm>(layer);
    }
}
