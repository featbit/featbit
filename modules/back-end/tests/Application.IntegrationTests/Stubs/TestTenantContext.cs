using System.Linq.Expressions;
using Api;
using Application.Services;
using Domain.Organizations;
using Moq;

namespace Application.IntegrationTests.Stubs;

public static class TestTenantContext
{
    public static void AddHeaders(HttpClient client)
    {
        client.DefaultRequestHeaders.Add(ApiConstants.WorkspaceHeaderKey, TestWorkspace.Id.ToString());
        client.DefaultRequestHeaders.Add(ApiConstants.OrgIdHeaderKey, TestWorkspace.OrganizationId.ToString());
    }

    public static Mock<IOrganizationService> CreateOrganizationService()
    {
        var organization = new Organization(TestWorkspace.Id, "Test organization", "test-org")
        {
            Id = TestWorkspace.OrganizationId, Initialized = true
        };
        var service = new Mock<IOrganizationService>();
        service.Setup(x => x.GetAsync(TestWorkspace.OrganizationId)).ReturnsAsync(organization);
        service.Setup(x => x.FindOneAsync(It.IsAny<Expression<Func<Organization, bool>>>()))
            .ReturnsAsync((Expression<Func<Organization, bool>> predicate) => predicate.Compile()(organization) ? organization : null);
        service.Setup(x => x.AnyAsync(It.IsAny<Expression<Func<Organization, bool>>>()))
            .ReturnsAsync((Expression<Func<Organization, bool>> predicate) => predicate.Compile()(organization));
        service.Setup(x => x.ContainsUserAsync(TestWorkspace.OrganizationId, TestUser.Id)).ReturnsAsync(true);
        return service;
    }
}
