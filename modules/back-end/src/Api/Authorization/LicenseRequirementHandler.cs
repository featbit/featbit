using Application.Services;

namespace Api.Authorization;

public class LicenseRequirementHandler(ILicenseService licenseService) : AuthorizationHandler<LicenseRequirement>
{
    protected override async Task HandleRequirementAsync(
        AuthorizationHandlerContext context,
        LicenseRequirement requirement)
    {
        if (context.Resource is not HttpContext httpContext)
        {
            return;
        }

        var workspaceId = httpContext.Request.WorkspaceId();
        if (workspaceId == Guid.Empty)
        {
            return;
        }

        var isFeatureGranted = await licenseService.IsFeatureGrantedAsync(workspaceId, requirement.Feature);
        if (isFeatureGranted)
        {
            context.Succeed(requirement);
        }
    }
}
