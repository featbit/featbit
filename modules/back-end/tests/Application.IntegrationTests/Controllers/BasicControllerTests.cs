using Api.Controllers;
using Application.Services;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Moq;

namespace Application.IntegrationTests.Controllers;

[Trait("Category", "Host")]
[Collection(nameof(TestApp))]
[Trait("Category", "Integration")]
public class BasicControllerTests
{
    private readonly TestApp _app;

    public BasicControllerTests(TestApp app)
    {
        _app = app;
    }

    [Fact]
    public async Task AuthorizedEndpoint_UnauthenticatedRequest_Returns401()
    {
        var response = await _app.GetAsync("api/v1/basic/authorized", authenticated: false);

        await Verify(response);
    }

    [Fact]
    public async Task AllowAnonymousEndpoint_UnauthenticatedRequest_Returns200()
    {
        var response = await _app.GetAsync("api/v1/basic/allow-anonymous", authenticated: false);

        await Verify(response);
    }

    [Fact]
    public async Task AuthorizedEndpoint_AuthenticatedRequest_Returns200()
    {
        var response = await _app.GetAsync("api/v1/basic/authorized", authenticated: true);

        await Verify(response);
    }

    [Fact]
    public async Task BasicEndpoint_ApiV1AndV2_RoutedToCorrectVersionAction()
    {
        var v1 = await _app.GetAsync("api/v1/basic/string");
        var v2 = await _app.GetAsync("api/v2/basic/string");

        await Verify(new { v1, v2 });
    }

    [Fact]
    public async Task ExceptionEndpoint_ActionThrows_ReturnsErrorResponse()
    {
        var response = await _app.GetAsync("api/v1/basic/exception");

        await Verify(response);
    }

    [Fact]
    public async Task BarEndpoint_PostRequestWithJsonBody_BindsModelAndEchoes()
    {
        var response = await _app.PostAsync("api/v2/basic/bar", new Bar("1", "bar"));

        await Verify(response);
    }

    [Fact]
    public async Task LicenseFeatureEndpoint_NoLicense_ReturnsForbidden()
    {
        var workspaces = new Mock<IWorkspaceService>();
        workspaces.Setup(x => x.GetAsync(TestWorkspace.Id)).ReturnsAsync(TestWorkspace.Instance);
        using var factory = _app.WithServices(services =>
            services.Replace(ServiceDescriptor.Singleton(workspaces.Object)));
        using var client = await _app.CreateAuthenticatedClientAsync(factory, includeTenantContext: true);
        var response = await client.GetAsync("api/v1/basic/license-feature-check");

        await Verify(response);
    }
}
