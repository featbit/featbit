namespace Api.Authorization;

public class PermissionRequirementHandler(IPermissionChecker permissionChecker)
    : AuthorizationHandler<PermissionRequirement>
{
    protected override async Task HandleRequirementAsync(
        AuthorizationHandlerContext context,
        PermissionRequirement requirement)
    {
        if (context.Resource is not HttpContext httpContext)
        {
            return;
        }

        if (await permissionChecker.IsGrantedAsync(httpContext, requirement))
        {
            context.Succeed(requirement);
        }
    }
}