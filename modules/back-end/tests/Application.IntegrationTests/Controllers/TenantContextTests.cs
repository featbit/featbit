using System.Net;
using System.Text;
using Api;
using Application.Services;
using Application.Users;
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
    [InlineData(null)]
    [InlineData("{}")]
    [InlineData("{\"workspaceId\":\"00000000-0000-0000-0000-000000000001\",\"organizationId\":\"00000000-0000-0000-0000-000000000002\"}")]
    public async Task JoinOrganization_UsesHeadersWithoutRequiringBody(string? body)
    {
        var authorization = new Mock<ISsoOrganizationJoinAuthorization>(MockBehavior.Strict);
        authorization.Setup(x => x.GetJoinAuthorizationAsync(TestWorkspace.Id, TestWorkspace.OrganizationId, TestUser.Id))
            .ReturnsAsync(new OrganizationJoinAuthorization(true, false));
        var sender = new Mock<ISender>(MockBehavior.Strict);
        sender.Setup(x => x.Send(It.Is<JoinOrganization>(request =>
                request.WorkspaceId == TestWorkspace.Id && request.OrganizationId == TestWorkspace.OrganizationId),
                It.IsAny<CancellationToken>())).ReturnsAsync(true);
        using var factory = app.WithServices(services =>
        {
            services.Replace(ServiceDescriptor.Singleton(authorization.Object));
            services.Replace(ServiceDescriptor.Singleton(sender.Object));
        });
        using var client = await app.CreateAuthenticatedClientAsync(factory);
        client.DefaultRequestHeaders.Add(ApiConstants.WorkspaceHeaderKey, TestWorkspace.Id.ToString());
        client.DefaultRequestHeaders.Add(ApiConstants.OrgIdHeaderKey, TestWorkspace.OrganizationId.ToString());
        using var content = body == null ? null : new StringContent(body, Encoding.UTF8, "application/json");

        using var response = await client.PostAsync("/api/v1/user/join-organization", content);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        sender.Verify(x => x.Send(It.Is<JoinOrganization>(request =>
            request.WorkspaceId == TestWorkspace.Id && request.OrganizationId == TestWorkspace.OrganizationId),
            It.IsAny<CancellationToken>()), Times.Once);
        Assert.Contains(response.Headers.GetValues("Set-Cookie"), cookie => cookie.StartsWith("sso-organization-join=;"));
    }

    [Theory]
    [InlineData("/api/v1/user/workspaces")]
    [InlineData("/api/v1/user/profile")]
    public async Task ExplicitUserActions_AllowAuthenticatedRequestsWithoutContext(string path)
    {
        using var client = await app.CreateAuthenticatedClientAsync(app);
        using var response = await client.GetAsync(path);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task ContextExemption_DoesNotBypassAuthentication()
    {
        using var client = app.CreateClient();
        using var response = await client.GetAsync("/api/v1/user/workspaces");
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
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

    [Theory]
    [InlineData(false, false, HttpStatusCode.Forbidden)]
    [InlineData(true, false, HttpStatusCode.OK)]
    [InlineData(true, true, HttpStatusCode.Forbidden)]
    public async Task OrganizationList_RequiresOnlyAWorkspaceTheUserBelongsTo(
        bool workspaceHeader, bool foreignWorkspace, HttpStatusCode expected)
    {
        var sender = new Mock<ISender>(MockBehavior.Strict);
        sender.Setup(x => x.Send(It.IsAny<GetOrganizationList>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Array.Empty<OrganizationVm>());
        using var factory = app.WithServices(services => services.Replace(ServiceDescriptor.Singleton(sender.Object)));
        using var client = await app.CreateAuthenticatedClientAsync(factory);
        if (workspaceHeader)
        {
            client.DefaultRequestHeaders.Add(ApiConstants.WorkspaceHeaderKey,
                (foreignWorkspace ? Guid.NewGuid() : TestWorkspace.Id).ToString());
        }

        using var response = await client.GetAsync("/api/v1/organizations");

        Assert.Equal(expected, response.StatusCode);
        sender.Verify(x => x.Send(It.IsAny<GetOrganizationList>(), It.IsAny<CancellationToken>()),
            expected == HttpStatusCode.OK ? Times.Once() : Times.Never());
    }
}
