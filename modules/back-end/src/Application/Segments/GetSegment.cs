using Domain.Segments;

namespace Application.Segments;

public class GetSegment : IRequest<Segment>
{
    public Guid OrgId { get; set; }

    public Guid EnvId { get; set; }

    public Guid Id { get; set; }
}

public class GetSegmentHandler(ISegmentService segmentService, SegmentPermissionGuard segmentGuard)
    : IRequestHandler<GetSegment, Segment>
{
    public async ValueTask<Segment> Handle(GetSegment request, CancellationToken cancellationToken)
    {
        await segmentGuard.EnsureInOrganizationAsync(request.OrgId, request.EnvId, request.Id);

        return await segmentService.GetAsync(request.Id);
    }
}