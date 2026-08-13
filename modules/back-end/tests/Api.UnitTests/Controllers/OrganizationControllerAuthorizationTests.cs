using Api.Controllers;
using Domain.Policies;
using Domain.Workspaces;
using Microsoft.AspNetCore.Authorization;

namespace Api.UnitTests.Controllers;

public class OrganizationControllerAuthorizationTests
{
    [Fact]
    public void Create_RequiresLicenseAndCreateOrganizationPermission()
    {
        var method = typeof(OrganizationController).GetMethod(nameof(OrganizationController.CreateAsync));

        var policies = method!
            .GetCustomAttributes(typeof(AuthorizeAttribute), inherit: true)
            .Cast<AuthorizeAttribute>()
            .Select(attribute => attribute.Policy)
            .ToArray();

        Assert.Contains(LicenseFeatures.MultiOrg, policies);
        Assert.Contains(Permissions.CreateOrg, policies);
    }
}
