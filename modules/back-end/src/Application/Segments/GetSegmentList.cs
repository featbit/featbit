using Application.Bases.Models;

namespace Application.Segments;

public class GetSegmentList : IRequest<PagedResult<SegmentVm>>
{
    public Guid WorkspaceId { get; set; }

    public Guid EnvId { get; set; }

    public SegmentFilter Filter { get; set; }
}

public class GetSegmentListHandler : IRequestHandler<GetSegmentList, PagedResult<SegmentVm>>
{
    private readonly IEnvironmentAppService _envAppService;

    public GetSegmentListHandler(IEnvironmentAppService envAppService)
    {
        _envAppService = envAppService;
    }

    public async ValueTask<PagedResult<SegmentVm>> Handle(GetSegmentList request, CancellationToken cancellationToken)
    {
        var segments = await _envAppService.GetPagedSegmentsAsync(request);

        return SegmentMapper.ToVm(segments);
    }
}