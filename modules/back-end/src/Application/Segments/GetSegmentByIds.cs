using Domain.Resources;
using Domain.Segments;

namespace Application.Segments;

public class GetSegmentByIds : IRequest<IEnumerable<Segment>>
{
    public Guid WorkspaceId { get; set; }

    public Guid EnvId { get; set; }

    public Guid[] Ids { get; set; }
}

public class GetSegmentByIdsHandler(ISegmentService service, IResourceServiceV2 resourceService)
    : IRequestHandler<GetSegmentByIds, IEnumerable<Segment>>
{
    public async Task<IEnumerable<Segment>> Handle(GetSegmentByIds request, CancellationToken cancellationToken)
    {
        var candidates = await service.FindManyAsync(x =>
            request.Ids.Contains(x.Id) &&
            ((x.Type == SegmentType.EnvironmentSpecific && x.EnvId == request.EnvId) ||
             (x.Type == SegmentType.Shared && x.WorkspaceId == request.WorkspaceId))
        );

        if (candidates.All(segment => segment.Type != SegmentType.Shared))
        {
            return candidates;
        }

        var envScope = await resourceService.GetRNAsync(request.EnvId, ResourceTypes.Env);
        return candidates.Where(segment =>
            segment.IsEnvironmentSpecific ||
            (!string.IsNullOrWhiteSpace(envScope) && segment.Scopes?.Any(scope => RN.IsInScope(envScope, scope)) == true)
        );
    }
}
