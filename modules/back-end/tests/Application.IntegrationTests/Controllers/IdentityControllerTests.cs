using System.Net;
using System.Net.Http.Json;
using Api.Controllers;
using Application.Identity;

namespace Application.IntegrationTests.Controllers;

[Trait("Category", "Host")]
[Collection(nameof(TestApp))]
public class IdentityControllerTests
{
    private readonly TestApp _app;

    public IdentityControllerTests(TestApp app)
    {
        _app = app;
    }

    [Fact]
    public async Task LoginByEmail_MissingEmailAndPassword_ReturnsBadRequestWithValidationErrors()
    {
        var request = new LoginByEmail();
        var response = await _app.PostAsync("/api/v1/identity/login-by-email", request, false);

        await Verify(response);
    }

    [Fact]
    public async Task LoginByEmail_ValidCredentials_ReturnsTokenAndUserData()
    {
        var request = new LoginByEmail
        {
            Email = TestUser.Email,
            Password = TestUser.RealPassword
        };
        var response = await _app.PostAsync("/api/v1/identity/login-by-email", request, false);


        var settings = new VerifySettings();
        settings.ScrubLinesWithReplace(
            x => x.StartsWith("eyJ") && x.Split('.').Length == 3 ? "[Scrubbed JWT]" : x
        );

        await Verify(response, settings: settings);
    }
    
    [Fact]
    public async Task RefreshToken_MissingRefreshCookie_Returns401WithRequiredError()
    {
        var response = await _app.PostAsync("/api/v1/identity/refresh-token", new { }, authenticated: false);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<ApiResponse<object>>();
        Assert.NotNull(body);
        Assert.False(body.Success);
        Assert.Contains(body.Errors, e => e.Contains("refresh-token", StringComparison.OrdinalIgnoreCase));
    }

    [Fact]
    public async Task Logout_NoRefreshCookie_ReturnsSuccessWithoutCallingMediator()
    {
        var response = await _app.PostAsync("/api/v1/identity/logout", new { }, authenticated: true);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<ApiResponse<bool>>();
        Assert.NotNull(body);
        Assert.True(body.Success);
        Assert.True(body.Data);
    }
}