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
public class SsoOrganizationJoinControllerTests(TestApp app)
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

}
