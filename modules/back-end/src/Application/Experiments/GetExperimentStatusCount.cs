namespace Application.Experiments;

public class GetExperimentStatusCount: IRequest<IEnumerable<ExperimentStatusCountVm>>
{
    public Guid EnvId { get; set; }
}

public class GetExperimentStatusCounterHandler : IRequestHandler<GetExperimentStatusCount, IEnumerable<ExperimentStatusCountVm>>
{
    private readonly IExperimentService _service;

    public GetExperimentStatusCounterHandler(IExperimentService service, IMapper mapper)
    {
        _service = service;
    }

    public async Task<IEnumerable<ExperimentStatusCountVm>> Handle(GetExperimentStatusCount request, CancellationToken cancellationToken)
    {
        return await _service.GetStatusCountAsync(request.EnvId);
    }
}