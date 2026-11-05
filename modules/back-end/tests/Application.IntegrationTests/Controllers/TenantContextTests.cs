using System.Net;
using Api;
using Application.Organizations;
using MediatR;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Moq;

namespace Application.IntegrationTests.Controllers;

[Trait("Category", "Host")]
[Collection(nameof(TestApp))]
public class TenantContextTests(TestApp app)
{
    [Theory]
    [InlineData(true, HttpStatusCode.OK)]
    [InlineData(false, HttpStatusCode.Unauthorized)]
    public async Task Profile_RequiresAuthenticationButNotTenantHeaders(bool authenticated, HttpStatusCode expected)
    {
        using var client = authenticated
            ? await app.CreateAuthenticatedClientAsync(app)
            : app.CreateClient();

        using var response = await client.GetAsync("/api/v1/user/profile");

        Assert.Equal(expected, response.StatusCode);
    }

    [Theory]
    [InlineData(false, false)]
    [InlineData(true, false)]
    [InlineData(false, true)]
    public async Task BusinessAction_MissingContextIsRejectedBeforeMediator(bool workspace, bool organization)
    {
        var sender = new Mock<ISender>(MockBehavior.Strict);
        using var factory = app.WithServices(services => services.Replace(ServiceDescriptor.Singleton(sender.Object)));
        using var client = await app.CreateAuthenticatedClientAsync(factory);
        if (workspace) client.DefaultRequestHeaders.Add(ApiConstants.WorkspaceHeaderKey, TestWorkspace.Id.ToString());
        if (organization) client.DefaultRequestHeaders.Add(ApiConstants.OrgIdHeaderKey, TestWorkspace.OrganizationId.ToString());

        using var response = await client.GetAsync($"/api/v1/envs/{Guid.NewGuid()}/feature-flags/flag");

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        sender.VerifyNoOtherCalls();
    }

    [Fact]
    public async Task ValidTenantContext_ContinuesToAction()
    {
        var sender = new Mock<ISender>(MockBehavior.Strict);
        sender.Setup(x => x.Send(It.IsAny<GetOrganizationList>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Array.Empty<OrganizationVm>());
        using var factory = app.WithServices(services => services.Replace(ServiceDescriptor.Singleton(sender.Object)));
        using var client = await app.CreateAuthenticatedClientAsync(factory, includeTenantContext: true);

        using var response = await client.GetAsync("/api/v1/organizations");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        sender.Verify(x => x.Send(It.IsAny<GetOrganizationList>(), It.IsAny<CancellationToken>()),
            Times.Once());
    }
}
