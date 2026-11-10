using Domain.Segments;
using Domain.Policies;

namespace Application.Segments;

public class GetFlagReferences : IRequest<IEnumerable<FlagReference>>
{
    public Guid OrgId { get; set; }

    public Guid EnvId { get; set; }

    public Guid Id { get; set; }
}

public class GetFlagReferencesHandler(ISegmentService service, SegmentAccessGuard access, IResourceService resources, IOrganizationPermissions permissions)
    : IRequestHandler<GetFlagReferences, IEnumerable<FlagReference>>
{
    public async Task<IEnumerable<FlagReference>> Handle(GetFlagReferences request, CancellationToken cancellationToken)
    {
        var references = new List<FlagReference>();

        await access.EnsureAccessibleAsync(request.OrgId, request.EnvId, request.Id);
        var segment = await service.GetAsync(request.Id);
        var envIds = await service.GetEnvironmentIdsAsync(segment);
        foreach (var envId in envIds.Distinct())
        {
            var resource = await resources.GetEnvRnAsync(envId);
            if (resource == null || !resource.OrganizationId.HasValue ||
                !PolicyHelper.IsAllowed(await permissions.GetAsync(resource.OrganizationId.Value), resource.Rn, Permissions.CanAccessEnv))
            {
                continue;
            }
            var envReferences = await service.GetFlagReferencesAsync(envId, request.Id);
            references.AddRange(envReferences);
        }

        return references;
    }
}