using Domain.Segments;

namespace Application.Segments;

public class GetSegment : IRequest<Segment>
{
    public Guid Id { get; set; }
}

public class GetSegmentHandler : IRequestHandler<GetSegment, Segment>
{
    private readonly ISegmentService _service;

    public GetSegmentHandler(ISegmentService service)
    {
        _service = service;
    }

    public async Task<Segment> Handle(GetSegment request, CancellationToken cancellationToken)
    {
        return await _service.GetAsync(request.Id);
    }
}