using Application.Bases.Models;

namespace Application.Experiments;

public class GetExperimentMetricList : IRequest<PagedResult<ExperimentMetricVm>>
{
    public Guid EnvId { get; set; }

    public ExperimentMetricFilter Filter { get; set; }
}

public class GetExperimentMetricListHandler : IRequestHandler<GetExperimentMetricList, PagedResult<ExperimentMetricVm>>
{
    private readonly IExperimentMetricService _service;
    private readonly IMapper _mapper;

    public GetExperimentMetricListHandler(IExperimentMetricService service, IMapper mapper)
    {
        _service = service;
        _mapper = mapper;
    }

    public async Task<PagedResult<ExperimentMetricVm>> Handle(GetExperimentMetricList request, CancellationToken cancellationToken)
    {
        var metrics = await _service.GetListAsync(request.EnvId, request.Filter);
        return _mapper.Map<PagedResult<ExperimentMetricVm>>(metrics);
    }
}