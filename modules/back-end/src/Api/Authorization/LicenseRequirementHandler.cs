using Api.Authentication;
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

        if (!httpContext.Request.Headers.TryGetValue(OpenApiConstants.OrgIdHeaderKey, out var orgIdString))
        {
            return;
        }

        if (!Guid.TryParse(orgIdString, out var orgId))
        {
            return;
        }

        var isFeatureGranted = await _licenseService.IsFeatureGrantedAsync(orgId, requirement.LicenseFeature);
        if (isFeatureGranted)
        {
            context.Succeed(requirement);
        }
    }
}