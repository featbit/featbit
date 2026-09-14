namespace Application.Experiments.ExperimentLayers;

public class CreateExperimentLayer : IRequest<ExperimentLayerVm>
{
    public Guid EnvId { get; set; }

    public CreateExperimentLayerRequest Request { get; set; }
}

public class CreateExperimentLayerHandler(IExperimentLayerService service, IMapper mapper)
    : IRequestHandler<CreateExperimentLayer, ExperimentLayerVm>
{
    public async Task<ExperimentLayerVm> Handle(
        CreateExperimentLayer request,
        CancellationToken cancellationToken)
    {
        var layer = await service.CreateAsync(request.EnvId, request.Request);
        return mapper.Map<ExperimentLayerVm>(layer);
    }
}
