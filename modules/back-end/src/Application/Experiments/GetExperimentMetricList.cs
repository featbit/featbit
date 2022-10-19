using Application.Bases.Models;

namespace Application.Experiments;

public class GetExperimentMetricList : IRequest<PagedResult<ExperimentMetricVm>>
{
    public Guid EnvId { get; set; }

    public ExperimentMetricFilter Filter { get; set; }
}

public class GetExperimentMetricHandler : IRequestHandler<GetExperimentMetricList, PagedResult<ExperimentMetricVm>>
{
    private readonly IExperimentMetricService _metricService;
    private readonly IUserService _userService;
    private readonly IMapper _mapper;

    public GetExperimentMetricHandler(
        IExperimentMetricService metricService,
        IUserService userService,
        IMapper mapper)
    {
        _metricService = metricService;
        _userService = userService;
        _mapper = mapper;
    }

    public async Task<PagedResult<ExperimentMetricVm>> Handle(GetExperimentMetricList request,
        CancellationToken cancellationToken)
    {
        var metrics = await _metricService.GetListAsync(request.EnvId, request.Filter);
        var users = await _userService.GetListAsync(metrics.Items.Select(x => x.MaintainerUserId));

        var vms = _mapper.Map<PagedResult<ExperimentMetricVm>>(metrics);
        foreach (var item in vms.Items)
        {
            var maintainer = users.FirstOrDefault(x => x.Id.ToString() == item.MaintainerUserId);
            if (maintainer == null)
            {
                continue;
            }

            item.MaintainerEmail = maintainer.Email;
            item.MaintainerName = maintainer.Name;
        }

        return vms;
    }
}