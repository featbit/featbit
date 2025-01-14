using Domain.Segments;

namespace Application.Segments;

public class GetSegmentByIds : IRequest<IEnumerable<Segment>>
{
    public Guid[] Ids { get; set; }
}

public class GetSegmentByIdsHandler : IRequestHandler<GetSegmentByIds, IEnumerable<Segment>>
{
    private readonly ISegmentService _service;

    public GetSegmentByIdsHandler(ISegmentService service)
    {
        _service = service;
    }

    public async Task<IEnumerable<Segment>> Handle(GetSegmentByIds request, CancellationToken cancellationToken)
    {
        return await _service.FindManyAsync(x => request.Ids.Contains(x.Id));
    }
}