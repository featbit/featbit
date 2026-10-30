using System.Net;
using System.Net.Http.Json;
using Domain.Shared;
using Domain.Workspaces;
using Infrastructure.Services;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Moq;

namespace Application.IntegrationTests.Http;

[Trait("Category", "Host")]
[Collection(nameof(TestApp))]
[Trait("Category", "Integration")]
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
    public async Task GetServerSideSdkPayload_WithClientSecret_Returns403()
    {
        var client = _app.CreateClient();
        client.DefaultRequestHeaders.Add("Authorization", TestData.ClientSecretString);

        var response = await client.GetAsync("/api/public/sdk/server/latest-all");

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task GetClientSideSdkPayload_WithValidAuthHeader_Returns200()
    {
        var client = _app.CreateClient();
        client.DefaultRequestHeaders.Add("Authorization", TestData.ClientSecretString);

        var request = new
        {
            keyId = "test-user",
            name = "Test User"
        };

        var response = await client.PostAsJsonAsync("/api/public/sdk/client/latest-all?timestamp=0", request);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task GetClientSideSdkPayload_WithoutAuthHeader_Returns401()
    {
        var client = _app.CreateClient();

        var request = new
        {
            user = new
            {
                keyId = "test-user",
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
    public async Task EvaluateFeatureFlag_WithValidAuthHeader_Returns200()
    {
        var client = _app.CreateClient();
        client.DefaultRequestHeaders.Add("Authorization", TestData.ServerSecretString);

        var request = new
        {
            user = new
            {
                keyId = "test-user",
                name = "Test User"
            }
        };

        var response = await client.PostAsJsonAsync("/api/public/featureflag/evaluate", request);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task EvaluateFeatureFlag_WithoutAuthHeader_Returns401()
    {
        var client = _app.CreateClient();

        var request = new
        {
            user = new
            {
                keyId = "test-user",
                name = "Test User"
            }
        };

        var response = await client.PostAsJsonAsync("/api/public/featureflag/evaluate", request);

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
    public async Task AgentRegister_WithValidRelayProxyKey_RegistersWithoutEnvironmentSecretLookup()
    {
        const string agentId = "regression-test-agent";
        var key = TestData.RelayProxyTokenString;
        var workspace = new Workspace { Id = Guid.NewGuid() };
        var relayProxy = new Mock<IRelayProxyAppService>(MockBehavior.Strict);
        relayProxy.Setup(x => x.GetWorkspaceAsync(key)).ReturnsAsync(workspace);
        relayProxy.Setup(x => x.CheckQuotaAsync(workspace)).ReturnsAsync(true);
        relayProxy.Setup(x => x.RegisterAgentAsync(key, agentId)).Returns(Task.CompletedTask);
        var store = new Mock<IStore>(MockBehavior.Strict);

        // Keep the real authentication/authorization pipeline. Only the independent
        // Relay Proxy service and environment store are replaced at the I/O boundary.
        using var host = _app.WithWebHostBuilder(builder => builder.ConfigureTestServices(services =>
        {
            services.Replace(ServiceDescriptor.Singleton<IRelayProxyAppService>(relayProxy.Object));
            services.Replace(ServiceDescriptor.Singleton<IStore>(store.Object));
        }));
        using var client = host.CreateClient();
        client.DefaultRequestHeaders.Add("Authorization", key);

        using var response = await client.PostAsJsonAsync("/api/public/agent/register", agentId);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(agentId, await response.Content.ReadAsStringAsync());
        relayProxy.Verify(x => x.GetWorkspaceAsync(key), Times.Once);
        relayProxy.Verify(x => x.CheckQuotaAsync(workspace), Times.Once);
        relayProxy.Verify(x => x.RegisterAgentAsync(key, agentId), Times.Once);
        relayProxy.VerifyNoOtherCalls();
        // Explicit verification is required: the auth handler catches store exceptions,
        // so a strict mock alone would not detect an accidental lookup on an anonymous endpoint.
        store.Verify(x => x.GetSecretAsync(It.IsAny<string>()), Times.Never);
        store.VerifyNoOtherCalls();
    }

    [Fact]
    public async Task AgentRegister_WithoutAuthHeader_Returns401()
    {
        // Agent uses a different auth model (relay-proxy key lookup)
        // The default handler returns NoResult; the controller independently rejects the missing RP key.
        var client = _app.CreateClient();

        var response = await client.PostAsJsonAsync("/api/public/agent/register", "agent-id");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }
}
