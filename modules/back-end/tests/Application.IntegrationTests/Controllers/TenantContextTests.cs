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
    public async Task OrganizationList_RequiresValidTenantContext(
        bool workspaceHeader, bool foreignWorkspace, HttpStatusCode expected)
    {
        var sender = new Mock<ISender>(MockBehavior.Strict);
        sender.Setup(x => x.Send(It.IsAny<GetOrganizationList>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Array.Empty<OrganizationVm>());
        using var factory = app.WithServices(services => services.Replace(ServiceDescriptor.Singleton(sender.Object)));
        using var client = await app.CreateAuthenticatedClientAsync(factory);
        client.DefaultRequestHeaders.Add(ApiConstants.OrgIdHeaderKey, TestWorkspace.OrganizationId.ToString());
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
