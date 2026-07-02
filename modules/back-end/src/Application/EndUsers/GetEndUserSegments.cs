namespace Application.EndUsers;

public class GetEndUserSegments : IRequest<IEnumerable<EndUserSegmentVm>>
{
    public Guid WorkspaceId { get; set; }

    public Guid EnvId { get; set; }

    public Guid Id { get; set; }
}

public class GetEndUserSegmentsHandler : IRequestHandler<GetEndUserSegments, IEnumerable<EndUserSegmentVm>>
{
    private readonly IEndUserService _endUserService;
    private readonly IEnvironmentAppService _envAppService;

    public GetEndUserSegmentsHandler(IEndUserService endUserService, IEnvironmentAppService envAppService)
    {
        _endUserService = endUserService;
        _envAppService = envAppService;
    }

    public async Task<IEnumerable<EndUserSegmentVm>> Handle(GetEndUserSegments request, CancellationToken cancellationToken)
    {
        var endUser = await _endUserService.GetAsync(request.Id);
        var segments = await _envAppService.GetSegmentsAsync(request.WorkspaceId, request.EnvId);

        var result = segments
            .Where(x => x.IsMatch(endUser))
            .Select(x => new EndUserSegmentVm(x));

        return result;
    }
}