using Domain.Segments;

namespace Application.Segments;

public class GetSegment : IRequest<Segment>
{
    public Guid OrgId { get; set; }

    public Guid EnvId { get; set; }

    public Guid Id { get; set; }
}

public class GetSegmentHandler(ISegmentService segmentService, IPermissionGuard permissionGuard)
    : IRequestHandler<GetSegment, Segment>
{
    public async Task<Segment> Handle(GetSegment request, CancellationToken cancellationToken)
    {
        await permissionGuard.EnsureSegmentOwnershipAsync(request.OrgId, request.EnvId, request.Id);

        return await segmentService.GetAsync(request.Id);
    }
}