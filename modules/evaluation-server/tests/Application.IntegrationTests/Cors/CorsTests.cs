using Microsoft.Net.Http.Headers;

namespace Application.IntegrationTests.Cors;

[Collection(nameof(TestApp))]
public class CorsTests
{
    private readonly TestApp _app;

    public CorsTests(TestApp app)
    {
        _app = app;
    }

    [Fact]
    public async Task Disabled_DoesNotEmitCorsHeaders()
    {
        var client = GetClient(enabled: false);

        var response = await SendPreflightAsync(client, "https://evil.example.com");

        Assert.False(response.Headers.Contains(HeaderNames.AccessControlAllowOrigin));
    }

    [Fact]
    public async Task Enabled_AllowsAnyOrigin_WithWildcardDefaults()
    {
        var client = GetClient();

        var response = await SendPreflightAsync(client, "https://evil.example.com");

        Assert.Equal("*", GetHeaderValue(response, HeaderNames.AccessControlAllowOrigin));
    }

    [Fact]
    public async Task Enabled_AllowsListedOrigin()
    {
        var client = GetClient(origins: "https://app.example.com;https://admin.example.com");

        var response = await SendPreflightAsync(client, "https://app.example.com");

        Assert.Equal("https://app.example.com", GetHeaderValue(response, HeaderNames.AccessControlAllowOrigin));
    }

    [Fact]
    public async Task Enabled_RejectsUnlistedOrigin()
    {
        var client = GetClient(origins: "https://app.example.com");

        var response = await SendPreflightAsync(client, "https://evil.example.com");

        Assert.False(response.Headers.Contains(HeaderNames.AccessControlAllowOrigin));
    }

    [Fact]
    public async Task Enabled_AllowsConfiguredHeader()
    {
        var client = GetClient(origins: "https://app.example.com", headers: "X-Custom;Authorization");

        var response = await SendPreflightAsync(client, "https://app.example.com", requestHeaders: "X-Custom");

        Assert.Contains(
            "X-Custom",
            GetHeaderValue(response, "Access-Control-Allow-Headers"),
            StringComparison.OrdinalIgnoreCase
        );
    }

    [Fact]
    public async Task Enabled_AllowsConfiguredMethod()
    {
        var client = GetClient(origins: "https://app.example.com", methods: "GET;POST");

        var response = await SendPreflightAsync(client, "https://app.example.com");

        Assert.Contains(
            "GET",
            GetHeaderValue(response, "Access-Control-Allow-Methods"),
            StringComparison.OrdinalIgnoreCase
        );
    }

    [Fact]
    public async Task Enabled_RejectsDisallowedHeader()
    {
        var client = GetClient(origins: "https://app.example.com", headers: "X-Custom;Authorization");

        var response = await SendPreflightAsync(client, "https://app.example.com", requestHeaders: "X-Forbidden");

        Assert.DoesNotContain(
            "X-Forbidden",
            GetHeaderValue(response, "Access-Control-Allow-Headers"),
            StringComparison.OrdinalIgnoreCase
        );
    }

    [Fact]
    public async Task Enabled_RejectsDisallowedMethod()
    {
        var client = GetClient(origins: "https://app.example.com", methods: "GET;POST");

        var response = await SendPreflightAsync(client, "https://app.example.com", requestMethod: "DELETE");

        Assert.DoesNotContain(
            "DELETE",
            GetHeaderValue(response, HeaderNames.AccessControlAllowMethods),
            StringComparison.OrdinalIgnoreCase
        );
    }

    [Fact]
    public async Task Enabled_AllowsCredentials_WithExplicitOrigin()
    {
        var client = GetClient(origins: "https://app.example.com", allowCredentials: true);

        var response = await SendPreflightAsync(client, "https://app.example.com");

        Assert.Equal("https://app.example.com", GetHeaderValue(response, HeaderNames.AccessControlAllowOrigin));
        Assert.Equal("true", GetHeaderValue(response, HeaderNames.AccessControlAllowCredentials));
    }

    private HttpClient GetClient(
        bool enabled = true,
        string origins = "*",
        string headers = "*",
        string methods = "*",
        bool allowCredentials = false)
    {
        var app = _app.WithSettings(
            ("Cors:Enabled", enabled.ToString()),
            ("Cors:AllowedOrigins", origins),
            ("Cors:AllowedHeaders", headers),
            ("Cors:AllowedMethods", methods),
            ("Cors:AllowCredentials", allowCredentials.ToString())
        );

        return app.CreateClient();
    }

    private static async Task<HttpResponseMessage> SendPreflightAsync(
        HttpClient client,
        string origin,
        string requestMethod = "GET",
        string? requestHeaders = null)
    {
        var request = new HttpRequestMessage(HttpMethod.Options, "/health/liveness");

        request.Headers.Add("Origin", origin);
        request.Headers.Add(HeaderNames.AccessControlRequestMethod, requestMethod);

        if (requestHeaders is not null)
        {
            request.Headers.Add(HeaderNames.AccessControlRequestHeaders, requestHeaders);
        }

        return await client.SendAsync(request);
    }

    private static string GetHeaderValue(HttpResponseMessage response, string headerName)
    {
        return response.Headers.TryGetValues(headerName, out var values)
            ? string.Join(",", values)
            : string.Empty;
    }
}