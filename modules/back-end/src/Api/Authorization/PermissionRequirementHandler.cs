using Api.Authentication;
using Domain.Policies;

namespace Api.Authorization;

public class PermissionRequirementHandler : AuthorizationHandler<PermissionRequirement>
{
    private readonly IPermissionChecker _permissionChecker;

    public PermissionRequirementHandler(IPermissionChecker permissionChecker)
    {
        _permissionChecker = permissionChecker;
    }

    protected override Task HandleRequirementAsync(
        AuthorizationHandlerContext context,
        PermissionRequirement requirement)
    {
        if (context.Resource is HttpContext httpContext &&
            httpContext.Items[OpenApiConstants.PermissionStoreKey] is IEnumerable<PolicyStatement> permissions)
        {
            if (_permissionChecker.IsGranted(permissions, requirement))
            {
                context.Succeed(requirement);
            }
        }

        return Task.CompletedTask;
    }
}