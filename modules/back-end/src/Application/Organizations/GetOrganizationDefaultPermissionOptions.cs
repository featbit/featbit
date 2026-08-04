using Application.Bases.Exceptions;
using Domain.Groups;
using Domain.Policies;

namespace Application.Organizations;

public class GetOrganizationDefaultPermissionOptions : IRequest<OrganizationDefaultPermissionOptionsVm>
{
    public Guid OrganizationId { get; set; }

    public Guid UserId { get; set; }
}

public class OrganizationDefaultPermissionOptionsVm
{
    public IReadOnlyCollection<OrganizationDefaultPolicyOptionVm> Policies { get; set; } = [];

    public IReadOnlyCollection<OrganizationDefaultGroupOptionVm> Groups { get; set; } = [];
}

public class OrganizationDefaultPolicyOptionVm
{
    public string Id { get; set; }

    public string Name { get; set; }

    public string Key { get; set; }

    public string Type { get; set; }
}

public class OrganizationDefaultGroupOptionVm
{
    public string Id { get; set; }

    public string Name { get; set; }
}

public class GetOrganizationDefaultPermissionOptionsHandler(
    IOrganizationService organizationService,
    IPolicyService policyService,
    IGroupService groupService)
    : IRequestHandler<GetOrganizationDefaultPermissionOptions, OrganizationDefaultPermissionOptionsVm>
{
    public async Task<OrganizationDefaultPermissionOptionsVm> Handle(
        GetOrganizationDefaultPermissionOptions request,
        CancellationToken cancellationToken)
    {
        if (!await organizationService.ContainsUserAsync(request.OrganizationId, request.UserId))
        {
            throw new ForbiddenException();
        }

        var organization = await organizationService.GetAsync(request.OrganizationId);
        var policyIds = organization.DefaultPermissions.PolicyIds.Distinct().ToArray();
        var groupIds = organization.DefaultPermissions.GroupIds.Distinct().ToArray();

        var policies = policyIds.Length == 0
            ? Array.Empty<Policy>()
            : await policyService.FindManyAsync(policy =>
                policyIds.Contains(policy.Id) &&
                (policy.OrganizationId == null || policy.OrganizationId == request.OrganizationId));
        var groups = groupIds.Length == 0
            ? Array.Empty<Group>()
            : await groupService.FindManyAsync(group =>
                groupIds.Contains(group.Id) && group.OrganizationId == request.OrganizationId);

        var policiesById = policies.ToDictionary(policy => policy.Id);
        var groupsById = groups.ToDictionary(group => group.Id);

        return new OrganizationDefaultPermissionOptionsVm
        {
            Policies = policyIds
                .Where(policiesById.ContainsKey)
                .Select(id => policiesById[id])
                .Select(policy => new OrganizationDefaultPolicyOptionVm
                {
                    Id = policy.Id.ToString(),
                    Name = policy.Name,
                    Key = policy.Key,
                    Type = policy.Type
                })
                .ToArray(),
            Groups = groupIds
                .Where(groupsById.ContainsKey)
                .Select(id => groupsById[id])
                .Select(group => new OrganizationDefaultGroupOptionVm
                {
                    Id = group.Id.ToString(),
                    Name = group.Name
                })
                .ToArray()
        };
    }
}
