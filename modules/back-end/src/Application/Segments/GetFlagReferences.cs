using Domain.Segments;
using Domain.Policies;

namespace Application.Segments;

public class GetFlagReferences : IRequest<IEnumerable<FlagReference>>
{
    public Guid OrgId { get; set; }

    public Guid EnvId { get; set; }

    public Guid Id { get; set; }
}

public class GetFlagReferencesHandler(
    ISegmentService segmentService,
    SegmentPermissionGuard permissionGuard,
    IPermissionTargetResolver targetResolver,
    IOrganizationPermissions permissions)
    : IRequestHandler<GetFlagReferences, IEnumerable<FlagReference>>
{
    public async Task<IEnumerable<FlagReference>> Handle(GetFlagReferences request, CancellationToken cancellationToken)
    {
        await permissionGuard.EnsureAccessibleAsync(request.OrgId, request.EnvId, request.Id);

        var references = new List<FlagReference>();
        var segment = await segmentService.GetAsync(request.Id);

        var envIds = await segmentService.GetEnvironmentIdsAsync(segment);
        foreach (var envId in envIds)
        {
            var target = await targetResolver.ResolveEnvironmentAsync(envId);
            if (target is not { OrganizationId: not null } ||
                !PolicyHelper.IsAllowed(await permissions.GetAsync(target.OrganizationId.Value), target.Rn, Permissions.CanAccessEnv))
            {
                continue;
            }
            var envReferences = await segmentService.GetFlagReferencesAsync(envId, request.Id);
            references.AddRange(envReferences);
        }

        return references;
    }
}