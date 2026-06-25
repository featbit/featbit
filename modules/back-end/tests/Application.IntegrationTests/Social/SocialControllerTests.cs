using System.Net;
using System.Net.Http.Json;

namespace Application.IntegrationTests.Social;

[Collection(nameof(TestApp))]
public class SocialControllerTests
{
    private readonly TestApp _app;

    public SocialControllerTests(TestApp app)
    {
        _app = app;
    }

    [Fact]
    public async Task Providers_NoOAuthConfigured_ReturnsEmptyProviderList()
    {
        var client = _app.CreateClient();
        var response = await client.GetAsync("/api/v1/social/providers?redirectUri=https://example.com");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<ApiEnvelope<List<ProviderVm>>>();
        Assert.NotNull(body);
        Assert.True(body!.Success);
        Assert.NotNull(body.Data);
        Assert.Empty(body.Data!);
    }

    [Fact]
    public async Task Login_UnsupportedProvider_ReturnsErrorResponse()
    {
        var response = await _app.PostAsync(
            "/api/v1/social/login",
            new { ProviderName = "does-not-exist", Code = "ignored", RedirectUri = "https://example.com" },
            authenticated: false);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<ApiEnvelope<object>>();
        Assert.NotNull(body);
        Assert.False(body!.Success);
        Assert.Contains("does-not-exist", string.Join(',', body.Errors));
    }

    private sealed class ApiEnvelope<TData>
    {
        public bool Success { get; set; }
        public IEnumerable<string> Errors { get; set; } = Array.Empty<string>();
        public TData? Data { get; set; }
    }

    private sealed class ProviderVm
    {
        public string Name { get; set; } = string.Empty;
        public string AuthorizeUrl { get; set; } = string.Empty;
    }
}
