using System.Text.Json;

namespace Application.IntegrationTests.Mcp;

[Collection(nameof(TestApp))]
public class McpOAuthControllerTests
{
    private readonly TestApp _app;

    public McpOAuthControllerTests(TestApp app)
    {
        _app = app;
    }

    [Fact]
    public async Task CreateDeviceCode_RequestValidation()
    {
        var response = await _app.PostAsync("/api/v1/mcp/oauth/device/code", new { client_id = "", env_id = Guid.Empty }, false);

        await Verify(response);
    }

    [Fact]
    public async Task DeviceCodeTokenRefreshAndRevokeFlow()
    {
        var createResponse = await _app.PostAsync("/api/v1/mcp/oauth/device/code", new
        {
            client_id = "codex",
            env_id = TestWorkspace.Id,
            experiment_id = TestReleaseDecisionExperimentService.ExperimentId
        }, false);
        var deviceCode = await ReadStringAsync(createResponse, "device_code");
        var userCode = await ReadStringAsync(createResponse, "user_code");

        var pendingResponse = await _app.PostAsync("/api/v1/mcp/oauth/token", new
        {
            grant_type = "urn:ietf:params:oauth:grant-type:device_code",
            device_code = deviceCode,
            client_id = "codex"
        }, false);

        var authorizeResponse = await _app.PostAsync(
            $"/api/v1/envs/{TestWorkspace.Id}/release-decision/mcp/oauth/device/authorize",
            new { user_code = userCode },
            includeWorkspaceContext: true);

        var tokenResponse = await _app.PostAsync("/api/v1/mcp/oauth/token", new
        {
            grant_type = "urn:ietf:params:oauth:grant-type:device_code",
            device_code = deviceCode,
            client_id = "codex"
        }, false);
        var refreshToken = await ReadStringAsync(tokenResponse, "refresh_token");
        var accessToken = await ReadStringAsync(tokenResponse, "access_token");

        var refreshResponse = await _app.PostAsync("/api/v1/mcp/oauth/token", new
        {
            grant_type = "refresh_token",
            refresh_token = refreshToken,
            client_id = "codex"
        }, false);

        var oldRefreshResponse = await _app.PostAsync("/api/v1/mcp/oauth/token", new
        {
            grant_type = "refresh_token",
            refresh_token = refreshToken,
            client_id = "codex"
        }, false);

        var revokeResponse = await _app.PostAsync("/api/v1/mcp/oauth/revoke", new
        {
            access_token = accessToken
        }, false);

        await Verify(new
        {
            Create = await NormalizeDeviceCodeResponseAsync(createResponse),
            Pending = await NormalizeOAuthErrorResponseAsync(pendingResponse),
            Authorize = await NormalizeAuthorizeResponseAsync(authorizeResponse),
            Token = await NormalizeTokenResponseAsync(tokenResponse),
            Refresh = await NormalizeTokenResponseAsync(refreshResponse),
            OldRefresh = await NormalizeOAuthErrorResponseAsync(oldRefreshResponse),
            RevokeStatus = (int)revokeResponse.StatusCode
        });
    }

    [Fact]
    public async Task CreateScopedToken_UsesEnvironmentScopeWhenWorkspaceHeadersAreMissing()
    {
        var response = await _app.PostAsync(
            $"/api/v1/envs/{TestWorkspace.Id}/release-decision/mcp/oauth/token",
            new
            {
                client_id = "featbit-coding-agent",
                experiment_id = TestReleaseDecisionExperimentService.ExperimentId
            });

        await Verify(await NormalizeTokenResponseAsync(response));
    }

    [Fact]
    public async Task AuthorizeDeviceCode_EnvMismatch()
    {
        var createResponse = await _app.PostAsync("/api/v1/mcp/oauth/device/code", new
        {
            client_id = "codex-env-mismatch",
            env_id = TestWorkspace.Id
        }, false);
        var userCode = await ReadStringAsync(createResponse, "user_code");

        var response = await _app.PostAsync(
            $"/api/v1/envs/99000000-0000-0000-0000-000000000001/release-decision/mcp/oauth/device/authorize",
            new { user_code = userCode },
            includeWorkspaceContext: true);

        await Verify(response);
    }

    [Fact]
    public async Task RevokeToken_MalformedToken()
    {
        var response = await _app.PostAsync("/api/v1/mcp/oauth/revoke", new { access_token = "not-a-jwt" }, false);

        await Verify(response);
    }

    private static async Task<object> NormalizeDeviceCodeResponseAsync(HttpResponseMessage response)
    {
        using var document = await ReadJsonDocumentAsync(response);
        var root = document.RootElement;

        return new
        {
            Status = (int)response.StatusCode,
            HasDeviceCode = !string.IsNullOrWhiteSpace(root.GetProperty("device_code").GetString()),
            UserCodeLength = root.GetProperty("user_code").GetString()?.Length,
            VerificationUri = root.GetProperty("verification_uri").GetString(),
            ExpiresInIsPositive = root.GetProperty("expires_in").GetInt32() > 0,
            Interval = root.GetProperty("interval").GetInt32()
        };
    }

    private static async Task<object> NormalizeTokenResponseAsync(HttpResponseMessage response)
    {
        using var document = await ReadJsonDocumentAsync(response);
        var root = document.RootElement;

        return new
        {
            Status = (int)response.StatusCode,
            HasAccessToken = !string.IsNullOrWhiteSpace(root.GetProperty("access_token").GetString()),
            HasRefreshToken = !string.IsNullOrWhiteSpace(root.GetProperty("refresh_token").GetString()),
            TokenType = root.GetProperty("token_type").GetString(),
            ExpiresIn = root.GetProperty("expires_in").GetInt32(),
            Scope = root.GetProperty("scope").GetString()
        };
    }

    private static async Task<object> NormalizeAuthorizeResponseAsync(HttpResponseMessage response)
    {
        using var document = await ReadJsonDocumentAsync(response);
        var root = document.RootElement;
        var data = root.GetProperty("data");

        return new
        {
            Status = (int)response.StatusCode,
            Success = root.GetProperty("success").GetBoolean(),
            ClientId = data.GetProperty("client_id").GetString(),
            EnvId = data.GetProperty("env_id").GetGuid(),
            ExperimentId = data.GetProperty("experiment_id").GetGuid()
        };
    }

    private static async Task<object> NormalizeOAuthErrorResponseAsync(HttpResponseMessage response)
    {
        using var document = await ReadJsonDocumentAsync(response);
        var root = document.RootElement;

        return new
        {
            Status = (int)response.StatusCode,
            Error = root.GetProperty("error").GetString(),
            ErrorDescription = root.GetProperty("error_description").GetString()
        };
    }

    private static async Task<string> ReadStringAsync(HttpResponseMessage response, string property)
    {
        using var document = await ReadJsonDocumentAsync(response);
        return document.RootElement.GetProperty(property).GetString()!;
    }

    private static async Task<JsonDocument> ReadJsonDocumentAsync(HttpResponseMessage response)
    {
        var json = await response.Content.ReadAsStringAsync();
        return JsonDocument.Parse(json);
    }
}
