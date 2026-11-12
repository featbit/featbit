using System.Net;
using System.Net.Http.Json;
using Api;
using Api.Controllers;
using Application.Bases;
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
    [Fact]
    public async Task UnmatchedEndpoint_WithoutTenantHeaders_ReturnsNotFound()
    {
        using var client = await app.CreateAuthenticatedClientAsync(app);

        using var response = await client.GetAsync("/api/v1/nonexistent-tenant-context-endpoint");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Theory]
    [InlineData(true, HttpStatusCode.OK)]
    [InlineData(false, HttpStatusCode.Unauthorized)]
    public async Task WorkspaceSelection_WithEmptyTenantHeaders_RequiresAuthentication(
        bool authenticated, HttpStatusCode expected)
    {
        using var client = authenticated
            ? await app.CreateAuthenticatedClientAsync(app)
            : app.CreateClient();
        client.DefaultRequestHeaders.Add(ApiConstants.WorkspaceHeaderKey, "");
        client.DefaultRequestHeaders.Add(ApiConstants.OrgIdHeaderKey, "");

        using var response = await client.GetAsync("/api/v1/user/workspaces");

        Assert.Equal(expected, response.StatusCode);
    }

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
        Assert.Equal("application/json", response.Content.Headers.ContentType?.MediaType);
        var body = await response.Content.ReadFromJsonAsync<ApiResponse<object>>();
        Assert.NotNull(body);
        Assert.False(body.Success);
        Assert.Equal(ErrorCodes.Forbidden, Assert.Single(body.Errors));
        sender.VerifyNoOtherCalls();
    }

    [Theory]
    [InlineData("member", HttpStatusCode.OK)]
    [InlineData("foreign", HttpStatusCode.Forbidden)]
    [InlineData("", HttpStatusCode.Forbidden)]
    [InlineData(null, HttpStatusCode.Forbidden)]
    [InlineData("invalid", HttpStatusCode.Forbidden)]
    public async Task OrganizationSelection_RequiresWorkspaceMembershipWithoutOrganizationHeader(
        string? workspace, HttpStatusCode expected)
    {
        var sender = new Mock<ISender>(MockBehavior.Strict);
        sender.Setup(x => x.Send(It.IsAny<GetOrganizationList>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Array.Empty<OrganizationVm>());
        using var factory = app.WithServices(services => services.Replace(ServiceDescriptor.Singleton(sender.Object)));
        using var client = await app.CreateAuthenticatedClientAsync(factory);
        if (workspace != null)
        {
            var workspaceValue = workspace switch
            {
                "member" => TestWorkspace.Id.ToString(),
                "foreign" => Guid.NewGuid().ToString(),
                _ => workspace
            };
            client.DefaultRequestHeaders.Add(ApiConstants.WorkspaceHeaderKey, workspaceValue);
        }
        client.DefaultRequestHeaders.Add(ApiConstants.OrgIdHeaderKey, "");

        using var response = await client.GetAsync("/api/v1/organizations");

        Assert.Equal(expected, response.StatusCode);
        sender.Verify(x => x.Send(It.IsAny<GetOrganizationList>(), It.IsAny<CancellationToken>()),
            expected == HttpStatusCode.OK ? Times.Once() : Times.Never());
    }
}
