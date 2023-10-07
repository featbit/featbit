using Api.Authentication;
using Application.License;

namespace Api.Authorization;

public class LicenseRequirementHandler : AuthorizationHandler<LicenseRequirement>
{
    private readonly ILicenseChecker _licenseChecker;

    public LicenseRequirementHandler(ILicenseChecker licenseChecker)
    {
        _licenseChecker = licenseChecker;
    }

    protected override async Task HandleRequirementAsync(
        AuthorizationHandlerContext context,
        LicenseRequirement requirement)
    {
        if (context.Resource is not HttpContext httpContext)
        {
            return;
        }

        if (!LicenseFeatures.IsDefined(requirement.LicenseFeature)) return;

        if (!httpContext.Request.Headers.TryGetValue(OpenApiConstants.OrgIdHeaderKey, out var orgId)) return;
        
        if (await _licenseChecker.Verify(Guid.Parse(orgId), requirement.LicenseFeature))
        {
            context.Succeed(requirement);
        }
    }
}