using Application.Bases.Exceptions;
using Application.Users;
using Domain.Groups;
using Domain.Policies;

namespace Application.Organizations;

public class GetDefaultPermissions : IRequest<DefaultPermissionsVm>
{
    public Guid OrganizationId { get; set; }
}

public class GetDefaultPermissionsHandler(
    IOrganizationService organizationService,
    IPolicyService policyService,
    IGroupService groupService,
    ICurrentUser currentUser)
    : IRequestHandler<GetDefaultPermissions, DefaultPermissionsVm>
{
    public async Task<DefaultPermissionsVm> Handle(
        GetDefaultPermissions request,
        CancellationToken cancellationToken)
    {
        if (!await organizationService.ContainsUserAsync(request.OrganizationId, currentUser.Id))
        {
            throw new ForbiddenException();
        }

        var organization = await organizationService.GetAsync(request.OrganizationId);
        var policyIds = organization.DefaultPermissions.PolicyIds.Distinct().ToArray();
        var groupIds = organization.DefaultPermissions.GroupIds.Distinct().ToArray();

        var policies = policyIds.Length == 0
            ? Array.Empty<Policy>()
            : await policyService.FindManyAsync(policy =>
                policyIds.Contains(policy.Id) && (policy.OrganizationId == null || policy.OrganizationId == request.OrganizationId)
            );
        var groups = groupIds.Length == 0
            ? Array.Empty<Group>()
            : await groupService.FindManyAsync(group =>
                groupIds.Contains(group.Id) && group.OrganizationId == request.OrganizationId
            );

        return new DefaultPermissionsVm(policies, groups);
    }
}
