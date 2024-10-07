using Application.Bases.Models;
using Domain.Resources;

namespace Application.Segments;

public class GetSegmentList : IRequest<PagedResult<SegmentVm>>
{
    public Guid EnvId { get; set; }

    public SegmentFilter Filter { get; set; }
}

public class GetSegmentListHandler : IRequestHandler<GetSegmentList, PagedResult<SegmentVm>>
{
    private readonly ISegmentService _segmentService;
    private readonly IResourceServiceV2 _resourceService;
    private readonly IMapper _mapper;

    public GetSegmentListHandler(
        ISegmentService segmentService,
        IResourceServiceV2 resourceService,
        IMapper mapper)
    {
        _segmentService = segmentService;
        _mapper = mapper;
        _resourceService = resourceService;
    }

    public async Task<PagedResult<SegmentVm>> Handle(GetSegmentList request, CancellationToken cancellationToken)
    {
        var rn = await _resourceService.GetRNAsync(request.EnvId, ResourceTypes.Env);
        var segments = await _segmentService.GetListAsync(rn, request.Filter);

        return _mapper.Map<PagedResult<SegmentVm>>(segments);
    }
}