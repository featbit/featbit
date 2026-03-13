using System.Net;
using System.Net.Http.Json;
using System.Net.WebSockets;
using Domain.Shared;
using Microsoft.AspNetCore.Mvc.Testing;

namespace Application.IntegrationTests.RateLimiting;

[Collection(nameof(TestApp))]
public class RateLimitingTests
{
    private readonly TestApp _app;

    public RateLimitingTests(TestApp app)
    {
        _app = app;
    }

    [Fact]
    public async Task DisabledRateLimiting_DoesNotReturn429()
    {
        var client = CreateClientWithRateLimitingSettings((
            "RateLimiting:Enabled", "false"
        ));

        client.DefaultRequestHeaders.Add("Authorization", TestData.ServerSecretString);

        HttpStatusCode[] statuses =
        [
            (await client.GetAsync("/api/public/sdk/server/latest-all")).StatusCode,
            (await client.GetAsync("/api/public/sdk/server/latest-all")).StatusCode,
            (await client.GetAsync("/api/public/sdk/server/latest-all")).StatusCode,
            (await client.GetAsync("/api/public/sdk/server/latest-all")).StatusCode,
            (await client.GetAsync("/api/public/sdk/server/latest-all")).StatusCode
        ];

        Assert.DoesNotContain(HttpStatusCode.TooManyRequests, statuses);
    }

    [Fact]
    public async Task ControllerPolicies_AreAppliedPerEndpoint()
    {
        var client = CreateClientWithRateLimitingSettings(
            ("RateLimiting:Enabled", "true"),
            ("RateLimiting:Distributed", "false"),
            ("RateLimiting:Type", "FixedWindow"),
            ("RateLimiting:PermitLimit", "100"),
            ("RateLimiting:WindowSeconds", "60"),
            ("RateLimiting:Endpoints:Sdk:PermitLimit", "1"),
            ("RateLimiting:Endpoints:Insight:PermitLimit", "1"),
            ("RateLimiting:Endpoints:FeatureFlag:PermitLimit", "1"),
            ("RateLimiting:Endpoints:Agent:PermitLimit", "1")
        );

        client.DefaultRequestHeaders.Add("Authorization", TestData.ServerSecretString);

        // SdkController [EnableRateLimiting("Sdk")]
        var sdkFirst = await client.GetAsync("/api/public/sdk/server/latest-all");
        var sdkSecond = await client.GetAsync("/api/public/sdk/server/latest-all");
        Assert.NotEqual(HttpStatusCode.TooManyRequests, sdkFirst.StatusCode);
        Assert.Equal(HttpStatusCode.TooManyRequests, sdkSecond.StatusCode);

        // InsightController [EnableRateLimiting("Insight")]
        var insightPayload = new[]
        {
            new
            {
                user = new { keyId = "user-1", name = "User 1" },
                variations = Array.Empty<object>(),
                metrics = Array.Empty<object>()
            }
        };

        var insightFirst = await client.PostAsJsonAsync("/api/public/insight/track", insightPayload);
        var insightSecond = await client.PostAsJsonAsync("/api/public/insight/track", insightPayload);
        Assert.NotEqual(HttpStatusCode.TooManyRequests, insightFirst.StatusCode);
        Assert.Equal(HttpStatusCode.TooManyRequests, insightSecond.StatusCode);

        // FeatureFlagController [EnableRateLimiting("FeatureFlag")]
        var evaluatePayload = new
        {
            user = new { keyId = "user-1", name = "User 1" }
        };

        var featureFlagFirst = await client.PostAsJsonAsync("/api/public/featureflag/evaluate", evaluatePayload);
        var featureFlagSecond = await client.PostAsJsonAsync("/api/public/featureflag/evaluate", evaluatePayload);
        Assert.NotEqual(HttpStatusCode.TooManyRequests, featureFlagFirst.StatusCode);
        Assert.Equal(HttpStatusCode.TooManyRequests, featureFlagSecond.StatusCode);

        // AgentController [EnableRateLimiting("Agent")]
        var agentFirst = await client.PostAsJsonAsync("/api/public/agent/register", "agent-1");
        var agentSecond = await client.PostAsJsonAsync("/api/public/agent/register", "agent-1");
        Assert.NotEqual(HttpStatusCode.TooManyRequests, agentFirst.StatusCode);
        Assert.Equal(HttpStatusCode.TooManyRequests, agentSecond.StatusCode);
    }

    [Fact]
    public async Task PartitionedByEnvId_OneEnvDoesNotThrottleAnother()
    {
        var client = CreateClientWithRateLimitingSettings(
            ("RateLimiting:Enabled", "true"),
            ("RateLimiting:Distributed", "false"),
            ("RateLimiting:Type", "FixedWindow"),
            ("RateLimiting:PermitLimit", "100"),
            ("RateLimiting:WindowSeconds", "60"),
            ("RateLimiting:Endpoints:Sdk:PermitLimit", "1")
        );

        client.DefaultRequestHeaders.Add("Authorization", TestData.ServerSecretString);
        var serverFirst = await client.GetAsync("/api/public/sdk/server/latest-all");
        var serverSecond = await client.GetAsync("/api/public/sdk/server/latest-all");

        Assert.NotEqual(HttpStatusCode.TooManyRequests, serverFirst.StatusCode);
        Assert.Equal(HttpStatusCode.TooManyRequests, serverSecond.StatusCode);

        client.DefaultRequestHeaders.Remove("Authorization");
        client.DefaultRequestHeaders.Add("Authorization", TestData.ClientSecretString);
        var clientEnvResponse = await client.GetAsync("/api/public/sdk/server/latest-all");

        Assert.NotEqual(HttpStatusCode.TooManyRequests, clientEnvResponse.StatusCode);
    }

    [Fact]
    public async Task RejectedRequest_ReturnsRetryAfterAndErrorBody()
    {
        var client = CreateClientWithRateLimitingSettings(
            ("RateLimiting:Enabled", "true"),
            ("RateLimiting:Distributed", "false"),
            ("RateLimiting:Type", "FixedWindow"),
            ("RateLimiting:PermitLimit", "100"),
            ("RateLimiting:WindowSeconds", "60"),
            ("RateLimiting:Endpoints:Sdk:PermitLimit", "1")
        );

        client.DefaultRequestHeaders.Add("Authorization", TestData.ServerSecretString);

        var first = await client.GetAsync("/api/public/sdk/server/latest-all");
        var second = await client.GetAsync("/api/public/sdk/server/latest-all");

        Assert.NotEqual(HttpStatusCode.TooManyRequests, first.StatusCode);
        Assert.Equal(HttpStatusCode.TooManyRequests, second.StatusCode);

        Assert.True(second.Headers.TryGetValues("Retry-After", out var values));
        Assert.True(int.TryParse(values.SingleOrDefault(), out var retryAfterSeconds));
        Assert.True(retryAfterSeconds >= 1);

        var body = await second.Content.ReadAsStringAsync();
        Assert.Contains("Rate limit exceeded", body);
    }

    [Fact]
    public async Task StreamingHandshake_IsRateLimited()
    {
        var app = CreateAppWithRateLimitingSettings(
            ("RateLimiting:Enabled", "true"),
            ("RateLimiting:Distributed", "false"),
            ("RateLimiting:Type", "FixedWindow"),
            ("RateLimiting:PermitLimit", "100"),
            ("RateLimiting:WindowSeconds", "60"),
            ("RateLimiting:Endpoints:Streaming:PermitLimit", "1")
        );

        var (firstConnected, firstSocket, _) = await TryConnectStreamingAsync(app, TestData.ClientTokenString);
        Assert.True(firstConnected);

        if (firstSocket is not null)
        {
            await firstSocket.CloseOutputAsync(WebSocketCloseStatus.NormalClosure, string.Empty, CancellationToken.None);
            firstSocket.Dispose();
        }

        var (_, _, secondError) = await TryConnectStreamingAsync(app, TestData.ClientTokenString);
        Assert.NotNull(secondError);
        Assert.Contains("429", secondError);
    }

    [Fact]
    public async Task DistributedEnabledButNoRedis_FallsBackToInMemoryLimiter()
    {
        // TestApp defaults to CacheProvider.None; this validates fallback behavior
        // when Distributed=true but Redis is not enabled.
        var client = CreateClientWithRateLimitingSettings(
            ("RateLimiting:Enabled", "true"),
            ("RateLimiting:Distributed", "true"),
            ("RateLimiting:Type", "FixedWindow"),
            ("RateLimiting:PermitLimit", "100"),
            ("RateLimiting:WindowSeconds", "60"),
            ("RateLimiting:Endpoints:Sdk:PermitLimit", "1")
        );

        client.DefaultRequestHeaders.Add("Authorization", TestData.ServerSecretString);

        var first = await client.GetAsync("/api/public/sdk/server/latest-all");
        var second = await client.GetAsync("/api/public/sdk/server/latest-all");

        Assert.NotEqual(HttpStatusCode.TooManyRequests, first.StatusCode);
        Assert.Equal(HttpStatusCode.TooManyRequests, second.StatusCode);
    }

    [Fact]
    public async Task EndpointOverrides_ApplyOverGlobalDefaults()
    {
        var client = CreateClientWithRateLimitingSettings(
            ("RateLimiting:Enabled", "true"),
            ("RateLimiting:Distributed", "false"),
            ("RateLimiting:Type", "FixedWindow"),
            ("RateLimiting:PermitLimit", "1"),
            ("RateLimiting:WindowSeconds", "60"),
            ("RateLimiting:Endpoints:Insight:PermitLimit", "2")
        );

        client.DefaultRequestHeaders.Add("Authorization", TestData.ServerSecretString);

        // Sdk uses global limit (1)
        var sdkFirst = await client.GetAsync("/api/public/sdk/server/latest-all");
        var sdkSecond = await client.GetAsync("/api/public/sdk/server/latest-all");

        Assert.NotEqual(HttpStatusCode.TooManyRequests, sdkFirst.StatusCode);
        Assert.Equal(HttpStatusCode.TooManyRequests, sdkSecond.StatusCode);

        // Insight uses endpoint override limit (2)
        var insightPayload = new[]
        {
            new
            {
                user = new { keyId = "user-2", name = "User 2" },
                variations = Array.Empty<object>(),
                metrics = Array.Empty<object>()
            }
        };

        var insightFirst = await client.PostAsJsonAsync("/api/public/insight/track", insightPayload);
        var insightSecond = await client.PostAsJsonAsync("/api/public/insight/track", insightPayload);
        var insightThird = await client.PostAsJsonAsync("/api/public/insight/track", insightPayload);

        Assert.NotEqual(HttpStatusCode.TooManyRequests, insightFirst.StatusCode);
        Assert.NotEqual(HttpStatusCode.TooManyRequests, insightSecond.StatusCode);
        Assert.Equal(HttpStatusCode.TooManyRequests, insightThird.StatusCode);
    }

    private HttpClient CreateClientWithRateLimitingSettings(params (string Key, string Value)[] settings)
    {
        var app = CreateAppWithRateLimitingSettings(settings);
        return app.CreateClient();
    }

    private WebApplicationFactory<Program> CreateAppWithRateLimitingSettings(
        params (string Key, string Value)[] settings)
    {
        var app = _app.WithWebHostBuilder(builder =>
        {
            foreach (var (key, value) in settings)
            {
                builder.UseSetting(key, value);
            }
        });

        return app;
    }

    private static async Task<(bool Connected, WebSocket? Socket, string? Error)> TryConnectStreamingAsync(
        WebApplicationFactory<Program> app,
        string token)
    {
        var wsClient = app.Server.CreateWebSocketClient();
        var uri = new Uri($"http://localhost/streaming?type=client&version=2&token={token}");

        try
        {
            var ws = await wsClient.ConnectAsync(uri, CancellationToken.None);
            return (ws.State == WebSocketState.Open, ws, null);
        }
        catch (Exception ex)
        {
            return (false, null, ex.ToString());
        }
    }
}
