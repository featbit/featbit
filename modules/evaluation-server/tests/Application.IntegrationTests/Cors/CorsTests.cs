using Microsoft.Net.Http.Headers;

namespace Application.IntegrationTests.Cors;

[Trait("Category", "Host")]
[Collection(nameof(TestApp))]
[Trait("Category", "Integration")]
public class CorsTests
{
    private readonly TestApp _app;

    public CorsTests(TestApp app)
    {
        _app = app;
    }

    [Fact]
    public async Task Preflight_CorsDisabled_DoesNotEmitCorsHeaders()
    {
        var client = GetClient(enabled: false);

        var response = await SendPreflightAsync(client, "https://evil.example.com");

        Assert.False(response.Headers.Contains(HeaderNames.AccessControlAllowOrigin));
    }

    [Fact]
    public async Task Preflight_DefaultWildcardOrigins_AllowsAnyOrigin()
    {
        var client = GetClient();

        var response = await SendPreflightAsync(client, "https://evil.example.com");

        Assert.Equal("*", GetHeaderValue(response, HeaderNames.AccessControlAllowOrigin));
    }

    [Fact]
    public async Task Preflight_ListedOrigin_EchoesOrigin()
    {
        var client = GetClient(origins: "https://app.example.com;https://admin.example.com");

        var response = await SendPreflightAsync(client, "https://app.example.com");

        Assert.Equal("https://app.example.com", GetHeaderValue(response, HeaderNames.AccessControlAllowOrigin));
    }

    [Fact]
    public async Task Preflight_UnlistedOrigin_OmitsAllowOriginHeader()
    {
        var client = GetClient(origins: "https://app.example.com");

        var response = await SendPreflightAsync(client, "https://evil.example.com");

        Assert.False(response.Headers.Contains(HeaderNames.AccessControlAllowOrigin));
    }

    [Fact]
    public async Task Preflight_ConfiguredHeader_AllowsHeader()
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
    public async Task Preflight_ConfiguredMethod_AllowsMethod()
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
    public async Task Preflight_DisallowedHeader_NotIncludedInAllowHeaders()
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
    public async Task Preflight_DisallowedMethod_NotIncludedInAllowMethods()
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
    public async Task Preflight_AllowCredentialsWithExplicitOrigin_EmitsAllowCredentialsHeader()
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
