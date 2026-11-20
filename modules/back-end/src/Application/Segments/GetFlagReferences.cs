using Application.Environments;
using Domain.Segments;

namespace Application.Segments;

public class GetFlagReferences : IRequest<IEnumerable<FlagReference>>
{
    public Guid OrgId { get; set; }

    public Guid EnvId { get; set; }

    public Guid Id { get; set; }
}

public class GetFlagReferencesHandler(
    ISegmentService segmentService,
    SegmentPermissionGuard segmentGuard,
    EnvironmentPermissionGuard envPermissionGuard)
    : IRequestHandler<GetFlagReferences, IEnumerable<FlagReference>>
{
    public async ValueTask<IEnumerable<FlagReference>> Handle(GetFlagReferences request, CancellationToken cancellationToken)
    {
        await segmentGuard.EnsureInOrganizationAsync(request.OrgId, request.EnvId, request.Id);

        var references = new List<FlagReference>();
        var segment = await segmentService.GetAsync(request.Id);

        var envIds = await segmentService.GetEnvironmentIdsAsync(segment);
        foreach (var envId in envIds)
        {
            if (!await envPermissionGuard.CanAccessAsync(envId))
            {
                continue;
            }

            var envReferences = await segmentService.GetFlagReferencesAsync(envId, request.Id);
            references.AddRange(envReferences);
        }

        return references;
    }
}