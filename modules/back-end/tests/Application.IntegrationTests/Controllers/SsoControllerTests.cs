using System.Net;
using System.Net.Http.Json;
using Api.Controllers;
using Application.Identity;

namespace Application.IntegrationTests.Controllers;

[Trait("Category", "Host")]
[Collection(nameof(TestApp))]
public class SsoControllerTests
{
    private readonly TestApp _app;

    public SsoControllerTests(TestApp app)
    {
        _app = app;
    }

    [Fact]
    public async Task PreCheck_Default_ReturnsTestWorkspaceAndSsoDisabled()
    {
        var client = _app.CreateClient();
        var response = await client.GetAsync("/api/v1/sso/pre-check");

        var body = await response.Content.ReadFromJsonAsync<ApiResponse<SsoPreCheck>>();

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.NotNull(body);
        Assert.True(body!.Success);
        Assert.NotNull(body.Data);
        Assert.False(body.Data!.IsEnabled);
        Assert.Equal(TestWorkspace.Key, body.Data.WorkspaceKey);
    }

    [Fact]
    public async Task GetOidcAuthorizeUrl_SsoDisabled_ReturnsBadRequest()
    {
        var client = _app.CreateClient();
        var response = await client.GetAsync(
            "/api/v1/sso/oidc-authorize-url?redirect_uri=https://example.com&workspace_key=" + TestWorkspace.Key);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var text = await response.Content.ReadAsStringAsync();
        Assert.Contains("SSO is not enabled", text);
    }

    [Fact]
    public async Task OidcLoginByCode_SsoDisabled_ReturnsErrorResponse()
    {
        var response = await _app.PostAsync(
            "/api/v1/sso/oidc/login",
            new { WorkspaceKey = TestWorkspace.Key, Code = "ignored", RedirectUri = "https://example.com" },
            authenticated: false);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<ApiResponse<object>>();
        Assert.NotNull(body);
        Assert.False(body!.Success);
        Assert.Contains("SSO is not enabled", string.Join(',', body.Errors));
    }
}
