using Domain.Policies;

namespace Api.Authorization;

public class PermissionRequirementHandler : AuthorizationHandler<PermissionRequirement>
{
    private readonly IPermissionChecker _permissionChecker;

    public PermissionRequirementHandler(IPermissionChecker permissionChecker)
    {
        _permissionChecker = permissionChecker;
    }

    protected override async Task HandleRequirementAsync(
        AuthorizationHandlerContext context,
        PermissionRequirement requirement)
    {
        // TODO: read permissions from http context
        if (await _permissionChecker.IsGrantedAsync(Array.Empty<PolicyStatement>(), requirement.PermissionName))
        {
            context.Succeed(requirement);
        }
    }
}