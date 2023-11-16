using Application.Services;

namespace Api.Authorization;

public class LicenseRequirementHandler : AuthorizationHandler<LicenseRequirement>
{
    private readonly ILicenseService _licenseService;

    public LicenseRequirementHandler(ILicenseService licenseService)
    {
        _licenseService = licenseService;
    }

    protected override async Task HandleRequirementAsync(
        AuthorizationHandlerContext context,
        LicenseRequirement requirement)
    {
        if (context.Resource is not HttpContext httpContext)
        {
            return;
        }

        if (!httpContext.Request.Headers.TryGetValue(ApiConstants.WorkspaceHeaderKey, out var workspaceIdString))
        {
            return;
        }

        if (!Guid.TryParse(workspaceIdString, out var workspaceId))
        {
            return;
        }

        var isFeatureGranted = await _licenseService.IsFeatureGrantedAsync(workspaceId, requirement.Feature);
        if (isFeatureGranted)
        {
            context.Succeed(requirement);
        }
    }
}