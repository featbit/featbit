using Api.Cors;
using Infrastructure.Caches;
using Infrastructure.MQ;
using Infrastructure.Persistence;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;

namespace Application.IntegrationTests.Cors;

[Collection(nameof(TestApp))]
public class CorsTests : IDisposable
{
    private WebApplicationFactory<Program>? _app;

    private WebApplicationFactory<Program> CreateApp(
        bool enabled = true,
        string origins = "*",
        string headers = "*",
        string methods = "*",
        bool allowCredentials = false)
    {
        _app?.Dispose();
        _app = new WebApplicationFactory<Program>().WithWebHostBuilder(builder =>
        {
            builder.UseSetting(DbProvider.SectionName, DbProvider.Fake);
            builder.UseSetting(MqProvider.SectionName, MqProvider.None);
            builder.UseSetting(CacheProvider.SectionName, CacheProvider.None);
            builder.UseSetting("Cors:Enabled", enabled.ToString());
            builder.UseSetting("Cors:AllowedOrigins", origins);
            builder.UseSetting("Cors:AllowedHeaders", headers);
            builder.UseSetting("Cors:AllowedMethods", methods);
            builder.UseSetting("Cors:AllowCredentials", allowCredentials.ToString());
        });

        return _app;
    }

    [Fact]
    public async Task Disabled_DoesNotEmitCorsHeaders()
    {
        var app = CreateApp(enabled: false);
        var client = app.CreateClient();

        var request = new HttpRequestMessage(HttpMethod.Options, "/health/liveness");
        request.Headers.Add("Origin", "https://evil.example.com");
        request.Headers.Add("Access-Control-Request-Method", "GET");

        var response = await client.SendAsync(request);

        Assert.False(response.Headers.Contains("Access-Control-Allow-Origin"));
    }

    [Fact]
    public async Task Enabled_AllowsAnyOrigin_WithWildcardDefaults()
    {
        var app = CreateApp();
        var client = app.CreateClient();

        var request = new HttpRequestMessage(HttpMethod.Options, "/health/liveness");
        request.Headers.Add("Origin", "https://evil.example.com");
        request.Headers.Add("Access-Control-Request-Method", "GET");

        var response = await client.SendAsync(request);

        Assert.True(response.Headers.Contains("Access-Control-Allow-Origin"));
        Assert.Equal("*", response.Headers.GetValues("Access-Control-Allow-Origin").First());
    }

    [Fact]
    public async Task Enabled_AllowsListedOrigin()
    {
        var app = CreateApp(enabled: true, origins: "https://app.example.com;https://admin.example.com");
        var client = app.CreateClient();

        var request = new HttpRequestMessage(HttpMethod.Options, "/health/liveness");
        request.Headers.Add("Origin", "https://app.example.com");
        request.Headers.Add("Access-Control-Request-Method", "GET");

        var response = await client.SendAsync(request);

        Assert.True(response.Headers.Contains("Access-Control-Allow-Origin"));
        Assert.Equal("https://app.example.com", response.Headers.GetValues("Access-Control-Allow-Origin").First());
    }

    [Fact]
    public async Task Enabled_RejectsUnlistedOrigin()
    {
        var app = CreateApp(enabled: true, origins: "https://app.example.com");
        var client = app.CreateClient();

        var request = new HttpRequestMessage(HttpMethod.Options, "/health/liveness");
        request.Headers.Add("Origin", "https://evil.example.com");
        request.Headers.Add("Access-Control-Request-Method", "GET");

        var response = await client.SendAsync(request);

        Assert.False(response.Headers.Contains("Access-Control-Allow-Origin"));
    }

    [Fact]
    public async Task Enabled_RestrictsHeadersWhenConfigured()
    {
        var app = CreateApp(enabled: true, origins: "https://app.example.com", headers: "X-Custom;Authorization");
        var client = app.CreateClient();

        var request = new HttpRequestMessage(HttpMethod.Options, "/health/liveness");
        request.Headers.Add("Origin", "https://app.example.com");
        request.Headers.Add("Access-Control-Request-Method", "GET");
        request.Headers.Add("Access-Control-Request-Headers", "X-Custom");

        var response = await client.SendAsync(request);

        Assert.True(response.Headers.Contains("Access-Control-Allow-Headers"));
        var allowedHeaders = response.Headers.GetValues("Access-Control-Allow-Headers").First();
        Assert.Contains("X-Custom", allowedHeaders, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task Enabled_RestrictsMethodsWhenConfigured()
    {
        var app = CreateApp(enabled: true, origins: "https://app.example.com", methods: "GET;POST");
        var client = app.CreateClient();

        var request = new HttpRequestMessage(HttpMethod.Options, "/health/liveness");
        request.Headers.Add("Origin", "https://app.example.com");
        request.Headers.Add("Access-Control-Request-Method", "GET");

        var response = await client.SendAsync(request);

        Assert.True(response.Headers.Contains("Access-Control-Allow-Methods"));
        var allowedMethods = response.Headers.GetValues("Access-Control-Allow-Methods").First();
        Assert.Contains("GET", allowedMethods, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task Enabled_RejectsDisallowedHeader()
    {
        var app = CreateApp(enabled: true, origins: "https://app.example.com", headers: "X-Custom;Authorization");
        var client = app.CreateClient();

        var request = new HttpRequestMessage(HttpMethod.Options, "/health/liveness");
        request.Headers.Add("Origin", "https://app.example.com");
        request.Headers.Add("Access-Control-Request-Method", "GET");
        request.Headers.Add("Access-Control-Request-Headers", "X-Forbidden");

        var response = await client.SendAsync(request);

        // ASP.NET Core advertises the policy's allowed headers in Access-Control-Allow-Headers
        // rather than silently omitting the header.  The browser rejects the preflight
        // because the requested header (X-Forbidden) is absent from the advertised list.
        var allowedHeaders = response.Headers.TryGetValues("Access-Control-Allow-Headers", out var headerValues)
            ? string.Join(",", headerValues)
            : string.Empty;
        Assert.DoesNotContain("X-Forbidden", allowedHeaders, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task Enabled_RejectsDisallowedMethod()
    {
        var app = CreateApp(enabled: true, origins: "https://app.example.com", methods: "GET;POST");
        var client = app.CreateClient();

        var request = new HttpRequestMessage(HttpMethod.Options, "/health/liveness");
        request.Headers.Add("Origin", "https://app.example.com");
        request.Headers.Add("Access-Control-Request-Method", "DELETE");

        var response = await client.SendAsync(request);

        // ASP.NET Core advertises the policy's allowed methods in Access-Control-Allow-Methods
        // rather than silently omitting the header.  The browser rejects the preflight
        // because the requested method (DELETE) is absent from the advertised list.
        var allowedMethods = response.Headers.TryGetValues("Access-Control-Allow-Methods", out var methodValues)
            ? string.Join(",", methodValues)
            : string.Empty;
        Assert.DoesNotContain("DELETE", allowedMethods, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task Enabled_AllowsCredentials_WithExplicitOrigin()
    {
        var app = CreateApp(
            enabled: true,
            origins: "https://app.example.com",
            headers: "*",
            methods: "*",
            allowCredentials: true);
        var client = app.CreateClient();

        var request = new HttpRequestMessage(HttpMethod.Options, "/health/liveness");
        request.Headers.Add("Origin", "https://app.example.com");
        request.Headers.Add("Access-Control-Request-Method", "GET");

        var response = await client.SendAsync(request);

        Assert.True(response.Headers.Contains("Access-Control-Allow-Origin"));
        Assert.Equal("https://app.example.com", response.Headers.GetValues("Access-Control-Allow-Origin").First());
        Assert.True(response.Headers.Contains("Access-Control-Allow-Credentials"));
        Assert.Equal("true", response.Headers.GetValues("Access-Control-Allow-Credentials").First());
    }

    [Fact]
    public void Validation_FailsWhen_Enabled_WithEmptyOrigins()
    {
        var options = new CorsOptions { Enabled = true, AllowedOrigins = [], AllowedHeaders = ["*"], AllowedMethods = ["*"] };
        var result = CreateValidator().Validate(null, options);

        Assert.True(result.Failed);
        Assert.Contains("AllowedOrigins must contain at least one value", result.FailureMessage);
    }

    [Fact]
    public void Validation_FailsWhen_Enabled_WithEmptyHeaders()
    {
        var options = new CorsOptions { Enabled = true, AllowedOrigins = ["*"], AllowedHeaders = [], AllowedMethods = ["*"] };
        var result = CreateValidator().Validate(null, options);

        Assert.True(result.Failed);
        Assert.Contains("AllowedHeaders must contain at least one value", result.FailureMessage);
    }

    [Fact]
    public void Validation_FailsWhen_Enabled_WithEmptyMethods()
    {
        var options = new CorsOptions { Enabled = true, AllowedOrigins = ["*"], AllowedHeaders = ["*"], AllowedMethods = [] };
        var result = CreateValidator().Validate(null, options);

        Assert.True(result.Failed);
        Assert.Contains("AllowedMethods must contain at least one value", result.FailureMessage);
    }

    [Fact]
    public void Validation_FailsWhen_AllowCredentials_WithWildcardOrigin()
    {
        var options = new CorsOptions
        {
            Enabled = true,
            AllowedOrigins = ["*"],
            AllowedHeaders = ["*"],
            AllowedMethods = ["*"],
            AllowCredentials = true
        };
        var result = CreateValidator().Validate(null, options);

        Assert.True(result.Failed);
        Assert.Contains("AllowCredentials cannot be used with a wildcard", result.FailureMessage);
    }

    [Fact]
    public void Validation_FailsWhen_MixedWildcardAndExplicitOrigins()
    {
        var options = new CorsOptions
        {
            Enabled = true,
            AllowedOrigins = ["*", "https://app.example.com"],
            AllowedHeaders = ["*"],
            AllowedMethods = ["*"]
        };
        var result = CreateValidator().Validate(null, options);

        Assert.True(result.Failed);
        Assert.Contains("AllowedOrigins cannot mix wildcard", result.FailureMessage);
    }

    [Fact]
    public void Validation_FailsWhen_CommaDelimiterIsUsed()
    {
        var options = new CorsOptions
        {
            Enabled = true,
            AllowedOrigins = ["https://app.example.com,https://admin.example.com"],
            AllowedHeaders = ["*"],
            AllowedMethods = ["*"]
        };
        var result = CreateValidator().Validate(null, options);

        Assert.True(result.Failed);
        Assert.Contains("Commas are not supported", result.FailureMessage);
    }

    [Fact]
    public void Validation_FailsWhen_OriginIsNotAbsoluteUri()
    {
        var options = new CorsOptions
        {
            Enabled = true,
            AllowedOrigins = ["example.com"],
            AllowedHeaders = ["*"],
            AllowedMethods = ["*"]
        };
        var result = CreateValidator().Validate(null, options);

        Assert.True(result.Failed);
        Assert.Contains("invalid value 'example.com'", result.FailureMessage);
    }

    [Fact]
    public void Validation_PassesWhen_Enabled_WithValidOrigins()
    {
        var options = new CorsOptions
        {
            Enabled = true,
            AllowedOrigins = ["https://app.example.com", "https://admin.example.com"],
            AllowedHeaders = ["Authorization", "X-Custom"],
            AllowedMethods = ["GET", "POST"]
        };
        var result = CreateValidator().Validate(null, options);

        Assert.True(result.Succeeded);
    }

    [Fact]
    public void Validation_SkippedWhen_Disabled()
    {
        var options = new CorsOptions
        {
            Enabled = false,
            AllowedOrigins = [],
            AllowedHeaders = [],
            AllowedMethods = [],
            AllowCredentials = true
        };
        var result = CreateValidator().Validate(null, options);

        Assert.True(result.Succeeded);
    }

    private static CorsOptionsValidator CreateValidator() => new();

    public void Dispose()
    {
        _app?.Dispose();
    }
}
