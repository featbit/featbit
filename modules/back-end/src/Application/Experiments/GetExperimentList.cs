using Application.Bases.Models;

namespace Application.Experiments;

public class GetExperimentList : IRequest<PagedResult<ExperimentVm>>
{
    public Guid EnvId { get; set; }

    public ExperimentFilter Filter { get; set; }
}

public class GetExperimentListHandler : IRequestHandler<GetExperimentList, PagedResult<ExperimentVm>>
{
    private readonly IExperimentService _service;
    private readonly IMapper _mapper;

    public GetExperimentListHandler(IExperimentService service, IMapper mapper)
    {
        _service = service;
        _mapper = mapper;
    }

    public async Task<PagedResult<ExperimentVm>> Handle(GetExperimentList request, CancellationToken cancellationToken)
    {
        var flags = await _service.GetListAsync(request.EnvId, request.Filter);
        return _mapper.Map<PagedResult<ExperimentVm>>(flags);
    }
}