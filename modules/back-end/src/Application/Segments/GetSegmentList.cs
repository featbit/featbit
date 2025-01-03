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
    private readonly IMapper _mapper;

    public GetSegmentListHandler(IEnvironmentAppService envAppService, IMapper mapper)
    {
        _envAppService = envAppService;
        _mapper = mapper;
    }

    public async Task<PagedResult<SegmentVm>> Handle(GetSegmentList request, CancellationToken cancellationToken)
    {
        var segments = await _envAppService.GetPagedSegmentsAsync(request);

        return _mapper.Map<PagedResult<SegmentVm>>(segments);
    }
}