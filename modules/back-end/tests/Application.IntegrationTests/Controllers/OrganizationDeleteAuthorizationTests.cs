using System.Net;
using Api;
using Api.Authorization;
using Application.Organizations;
using Application.Services;
using Domain.Policies;
using Domain.Resources;
using MediatR;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Moq;

namespace Application.IntegrationTests.Controllers;

[Trait("Category", "Host")]
[Collection(nameof(TestApp))]
public class OrganizationDeleteAuthorizationTests(TestApp app)
{
    [Theory]
    [InlineData(false, false, false, HttpStatusCode.Forbidden)]
    [InlineData(true, true, false, HttpStatusCode.Forbidden)]
    [InlineData(true, false, false, HttpStatusCode.OK)]
    [InlineData(true, false, true, HttpStatusCode.Forbidden)]
    public async Task DeleteAsync_MembershipPolicies_EnforcesOrganizationDeletePermission(
        bool allowDelete, bool denyDelete, bool foreignOrganization, HttpStatusCode expected)
    {
        var memberOrganization = Guid.NewGuid();
        var targetOrganization = foreignOrganization ? Guid.NewGuid() : memberOrganization;
        var policies = new List<PolicyStatement>
        {
            new() { ResourceType = ResourceTypes.Env, Effect = EffectType.Allow, Actions = [Permissions.CanAccessEnv], Resources = ["*"] }
        };
        if (allowDelete)
            policies.Add(new PolicyStatement { ResourceType = ResourceTypes.Organization, Effect = EffectType.Allow, Actions = ["DeleteOrg"], Resources = ["*"] });
        if (denyDelete)
            policies.Add(new PolicyStatement { ResourceType = ResourceTypes.Organization, Effect = EffectType.Deny, Actions = ["DeleteOrg"], Resources = ["*"] });
        var members = new Mock<IMemberService>();
        members.Setup(x => x.GetPermissionsAsync(It.IsAny<Guid>(), TestUser.Id))
            .Returns((Guid orgId, Guid _) => Task.FromResult(orgId == memberOrganization ? policies.ToArray() : []));
        var sender = new Mock<ISender>(MockBehavior.Strict);
        sender.Setup(x => x.Send(It.IsAny<DeleteOrganization>(), It.IsAny<CancellationToken>())).ReturnsAsync(true);
        using var factory = app.WithServices(services =>
        {
            services.Replace(ServiceDescriptor.Scoped<IPermissionChecker, DefaultPermissionChecker>());
            services.Replace(ServiceDescriptor.Scoped<IRequestPermissions, RequestPermissions>());
            services.Replace(ServiceDescriptor.Singleton(members.Object));
            services.Replace(ServiceDescriptor.Singleton(sender.Object));
        });
        using var client = await app.CreateAuthenticatedClientAsync(factory);
        client.DefaultRequestHeaders.Add(ApiConstants.OrgIdHeaderKey, targetOrganization.ToString());

        var response = await client.DeleteAsync("/api/v1/organizations");

        Assert.Equal(expected, response.StatusCode);
        sender.Verify(x => x.Send(It.Is<DeleteOrganization>(request => request.Id == targetOrganization),
            It.IsAny<CancellationToken>()), expected == HttpStatusCode.OK ? Times.Once() : Times.Never());
    }
}
