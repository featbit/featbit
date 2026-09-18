using System.Net;
using System.Net.Http.Json;
using Domain.Shared;

namespace Application.IntegrationTests.Http;

[Trait("Category", "Host")]
[Collection(nameof(TestApp))]
public class HttpAuthenticationTests
{
    private readonly TestApp _app;

    public HttpAuthenticationTests(TestApp app)
    {
        _app = app;
    }

    [Fact]
    public async Task GetServerSideSdkPayload_WithValidAuthHeader_Returns200()
    {
        var client = _app.CreateClient();
        client.DefaultRequestHeaders.Add("Authorization", TestData.ServerSecretString);

        var response = await client.GetAsync("/api/public/sdk/server/latest-all");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task GetServerSideSdkPayload_WithoutAuthHeader_Returns401()
    {
        var client = _app.CreateClient();

        var response = await client.GetAsync("/api/public/sdk/server/latest-all");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task GetServerSideSdkPayload_WithMalformedAuthHeader_Returns401()
    {
        var client = _app.CreateClient();
        client.DefaultRequestHeaders.Add("Authorization", "malformed-secret");

        var response = await client.GetAsync("/api/public/sdk/server/latest-all");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task GetServerSideSdkPayload_WithClientSecret_Returns200()
    {
        var client = _app.CreateClient();
        client.DefaultRequestHeaders.Add("Authorization", TestData.ClientSecretString);

        var response = await client.GetAsync("/api/public/sdk/server/latest-all");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task GetClientSideSdkPayload_WithValidAuthHeader_IsNotUnauthorized()
    {
        var client = _app.CreateClient();
        client.DefaultRequestHeaders.Add("Authorization", TestData.ServerSecretString);

        var request = new
        {
            user = new
            {
                key = "test-user",
                name = "Test User"
            }
        };

        var response = await client.PostAsJsonAsync("/api/public/sdk/client/latest-all?timestamp=0", request);

        Assert.NotEqual(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task GetClientSideSdkPayload_WithoutAuthHeader_Returns401()
    {
        var client = _app.CreateClient();

        var request = new
        {
            user = new
            {
                key = "test-user",
                name = "Test User"
            }
        };

        var response = await client.PostAsJsonAsync("/api/public/sdk/client/latest-all?timestamp=0", request);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task TrackInsight_WithValidAuthHeader_Returns200()
    {
        var client = _app.CreateClient();
        client.DefaultRequestHeaders.Add("Authorization", TestData.ServerSecretString);

        var response = await client.PostAsJsonAsync("/api/public/insight/track", Array.Empty<object>());

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task TrackInsight_WithoutAuthHeader_Returns401()
    {
        var client = _app.CreateClient();

        var response = await client.PostAsJsonAsync("/api/public/insight/track", Array.Empty<object>());

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task EvaluateFeatureFlag_WithValidAuthHeader_IsNotUnauthorized()
    {
        var client = _app.CreateClient();
        client.DefaultRequestHeaders.Add("Authorization", TestData.ServerSecretString);

        var request = new
        {
            user = new
            {
                key = "test-user",
                name = "Test User"
            }
        };

        var response = await client.PostAsJsonAsync("/api/public/feature-flag/evaluate", request);

        Assert.NotEqual(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task EvaluateFeatureFlag_WithoutAuthHeader_Returns401()
    {
        var client = _app.CreateClient();

        var request = new
        {
            user = new
            {
                key = "test-user",
                name = "Test User"
            }
        };

        var response = await client.PostAsJsonAsync("/api/public/feature-flag/evaluate", request);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task HealthCheck_WithoutAuthHeader_Returns200()
    {
        var client = _app.CreateClient();

        var response = await client.GetAsync("/health/liveness");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task AgentRegister_WithoutAuthHeader_Returns401()
    {
        // Agent uses a different auth model (relay-proxy key lookup)
        // Without auth, should fail but with a different path (no AuthenticationHandler involved)
        var client = _app.CreateClient();

        var response = await client.PostAsJsonAsync("/api/public/agent/register", "agent-id");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }
}
