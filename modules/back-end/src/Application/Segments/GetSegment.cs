using Domain.Segments;

namespace Application.Segments;

public class GetSegment : IRequest<Segment>
{
    public Guid OrgId { get; set; }

    public Guid EnvId { get; set; }

    public Guid Id { get; set; }
}

public class GetSegmentHandler : IRequestHandler<GetSegment, Segment>
{
    private readonly ISegmentService _service;
    private readonly SegmentAccessGuard _access;

    public GetSegmentHandler(ISegmentService service, SegmentAccessGuard access)
    {
        _service = service;
        _access = access;
    }

    public async Task<Segment> Handle(GetSegment request, CancellationToken cancellationToken)
    {
        await _access.EnsureAccessibleAsync(request.OrgId, request.EnvId, request.Id);
        return await _service.GetAsync(request.Id);
    }
}