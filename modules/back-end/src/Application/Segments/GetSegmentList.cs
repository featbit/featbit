using Application.Bases.Models;

namespace Application.Segments;

public class GetSegmentList : IRequest<PagedResult<SegmentVm>>
{
    public Guid EnvId { get; set; }

    public SegmentFilter Filter { get; set; }
}

public class GetSegmentListHandler : IRequestHandler<GetSegmentList, PagedResult<SegmentVm>>
{
    private readonly ISegmentService _service;
    private readonly IMapper _mapper;

    public GetSegmentListHandler(ISegmentService service, IMapper mapper)
    {
        _service = service;
        _mapper = mapper;
    }

    public async Task<PagedResult<SegmentVm>> Handle(GetSegmentList request, CancellationToken cancellationToken)
    {
        var segments = await _service.GetListAsync(request.EnvId, request.Filter);

        return _mapper.Map<PagedResult<SegmentVm>>(segments);
    }
}