using Application.Bases;
using Application.Bases.Models;
using Application.Experiments;

namespace Application.Experiments.ExperimentLayers;

public class GetExperimentLayerList : IRequest<PagedResult<ExperimentLayerVm>>
{
    public Guid EnvId { get; set; }

    public ExperimentLayerFilter Filter { get; set; }
}

public class GetExperimentLayersHandler(
    IExperimentLayerService layerService,
    IExperimentService experimentService,
    IMapper mapper)
    : IRequestHandler<GetExperimentLayerList, PagedResult<ExperimentLayerVm>>
{
    public async Task<PagedResult<ExperimentLayerVm>> Handle(
        GetExperimentLayerList request,
        CancellationToken cancellationToken)
    {
        var layers = await layerService.GetListAsync(request.EnvId, request.Filter);
        IReadOnlyCollection<ExperimentRunForLayer> runs = layers.Items.Count == 0
            ? []
            : await experimentService.GetExperimentRunsByLayersAsync(request.EnvId, layers.Items);
        var result = mapper.Map<PagedResult<ExperimentLayerVm>>(layers);

        foreach (var layer in layers.Items)
        {
            var vm = result.Items.First(x => x.Id == layer.Id);
            var readModel = ExperimentLayerReadModel.Build(
                layer,
                runs.Where(x => ExperimentLayerReadModel.IsRunForLayer(x.Run, layer)));
            vm.ExperimentRuns = readModel.ExperimentRuns.ToArray();
            vm.AllocationSummary = readModel.AllocationSummary;
        }

        return result;
    }
}
