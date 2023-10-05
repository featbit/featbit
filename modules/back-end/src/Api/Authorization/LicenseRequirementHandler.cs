using Api.Authentication;
using Domain.Policies;

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

        if (!LicenseItems.IsDefined(requirement.LicenseItem)) return;

        if (!httpContext.Request.Headers.TryGetValue(OpenApiConstants.OrgIdHeaderKey, out var orgId)) return;
        
        if (await _licenseChecker.Verify(Guid.Parse(orgId), requirement.LicenseItem))
        {
            context.Succeed(requirement);
        }
    }
}