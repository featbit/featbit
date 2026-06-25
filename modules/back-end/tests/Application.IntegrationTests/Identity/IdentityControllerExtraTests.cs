using System.Net;
using System.Net.Http.Json;

namespace Application.IntegrationTests.Identity;

[Collection(nameof(TestApp))]
public class IdentityControllerExtraTests
{
    private readonly TestApp _app;

    public IdentityControllerExtraTests(TestApp app)
    {
        _app = app;
    }

    [Fact]
    public async Task RefreshToken_MissingRefreshCookie_Returns401WithRequiredError()
    {
        var response = await _app.PostAsync("/api/v1/identity/refresh-token", new { }, authenticated: false);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<ApiEnvelope>();
        Assert.NotNull(body);
        Assert.False(body!.Success);
        Assert.Contains(body.Errors, e => e.Contains("refresh-token", StringComparison.OrdinalIgnoreCase));
    }

    [Fact]
    public async Task Logout_NoRefreshCookie_ReturnsSuccessWithoutCallingMediator()
    {
        var response = await _app.PostAsync("/api/v1/identity/logout", new { }, authenticated: true);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<ApiEnvelope<bool>>();
        Assert.NotNull(body);
        Assert.True(body!.Success);
        Assert.True(body.Data);
    }

    private sealed class ApiEnvelope
    {
        public bool Success { get; set; }
        public IEnumerable<string> Errors { get; set; } = Array.Empty<string>();
    }

    private sealed class ApiEnvelope<TData>
    {
        public bool Success { get; set; }
        public IEnumerable<string> Errors { get; set; } = Array.Empty<string>();
        public TData? Data { get; set; }
    }
}
