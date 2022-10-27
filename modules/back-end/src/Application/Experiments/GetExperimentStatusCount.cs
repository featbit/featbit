namespace Application.Experiments;

public class GetExperimentStatusCount: IRequest<IEnumerable<ExperimentStatusCountVm>>
{
    public Guid EnvId { get; set; }
}

public class GetExperimentStatusCounterHandler : IRequestHandler<GetExperimentStatusCount, IEnumerable<ExperimentStatusCountVm>>
{
    private readonly IExperimentService _service;
    private readonly IMapper _mapper;

    public GetExperimentStatusCounterHandler(IExperimentService service, IMapper mapper)
    {
        _service = service;
        _mapper = mapper;
    }

    public async Task<IEnumerable<ExperimentStatusCountVm>> Handle(GetExperimentStatusCount request, CancellationToken cancellationToken)
    {
        var flags = await _service.GetStatusCountAsync(request.EnvId);
        return _mapper.Map<IEnumerable<ExperimentStatusCountVm>>(flags);
    }
}