using System.Collections.Concurrent;
using System.Text.Json;
using System.Net.Http.Json;
using Application.Services;
using Domain.Environments;
using Domain.Mcp;
using Domain.Organizations;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Moq;

namespace Application.IntegrationTests.Controllers;

[Trait("Category", "Host")]
[Collection(nameof(TestApp))]
public class McpOAuthControllerTests
{
    private static readonly Guid ExperimentId = new("10000000-0000-0000-0000-000000000001");
    private readonly TestApp _app;

    public McpOAuthControllerTests(TestApp app)
    {
        _app = app;
    }

    [Fact]
    public async Task CreateDeviceCode_RequestValidation()
    {
        using var factory = CreateFactory(new InMemoryMcpAuthorizationStore());
        using var client = factory.CreateClient();

        var response = await client.PostAsJsonAsync(
            "/api/v1/mcp/oauth/device/code",
            new { client_id = "", env_id = Guid.Empty });

        await Verify(response);
    }

    [Fact]
    public async Task DeviceCodeTokenRefreshAndRevokeFlow()
    {
        using var factory = CreateFactory(new InMemoryMcpAuthorizationStore());
        using var anonymousClient = factory.CreateClient();
        using var authenticatedClient = await _app.CreateAuthenticatedClientAsync(factory);
        AddWorkspaceContext(authenticatedClient);

        var createResponse = await anonymousClient.PostAsJsonAsync("/api/v1/mcp/oauth/device/code", new
        {
            client_id = "codex",
            env_id = TestWorkspace.Id,
            experiment_id = ExperimentId
        });
        var deviceCode = await ReadStringAsync(createResponse, "device_code");
        var userCode = await ReadStringAsync(createResponse, "user_code");

        var pendingResponse = await anonymousClient.PostAsJsonAsync("/api/v1/mcp/oauth/token", new
        {
            grant_type = "urn:ietf:params:oauth:grant-type:device_code",
            device_code = deviceCode,
            client_id = "codex"
        });

        var authorizeResponse = await authenticatedClient.PostAsJsonAsync(
            $"/api/v1/envs/{TestWorkspace.Id}/mcp/oauth/device/authorize",
            new { user_code = userCode });

        var tokenResponse = await anonymousClient.PostAsJsonAsync("/api/v1/mcp/oauth/token", new
        {
            grant_type = "urn:ietf:params:oauth:grant-type:device_code",
            device_code = deviceCode,
            client_id = "codex"
        });
        var refreshToken = await ReadStringAsync(tokenResponse, "refresh_token");
        var accessToken = await ReadStringAsync(tokenResponse, "access_token");

        var refreshResponse = await anonymousClient.PostAsJsonAsync("/api/v1/mcp/oauth/token", new
        {
            grant_type = "refresh_token",
            refresh_token = refreshToken,
            client_id = "codex"
        });

        var oldRefreshResponse = await anonymousClient.PostAsJsonAsync("/api/v1/mcp/oauth/token", new
        {
            grant_type = "refresh_token",
            refresh_token = refreshToken,
            client_id = "codex"
        });

        var revokeResponse = await anonymousClient.PostAsJsonAsync("/api/v1/mcp/oauth/revoke", new
        {
            access_token = accessToken
        });

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
        using var factory = CreateFactory(new InMemoryMcpAuthorizationStore());
        using var client = await _app.CreateAuthenticatedClientAsync(factory);

        var response = await client.PostAsJsonAsync(
            $"/api/v1/envs/{TestWorkspace.Id}/mcp/oauth/token",
            new
            {
                client_id = "featbit-coding-agent",
                experiment_id = ExperimentId
            });

        await Verify(await NormalizeTokenResponseAsync(response));
    }

    [Fact]
    public async Task AuthorizeDeviceCode_EnvMismatch()
    {
        using var factory = CreateFactory(new InMemoryMcpAuthorizationStore());
        using var anonymousClient = factory.CreateClient();
        using var authenticatedClient = await _app.CreateAuthenticatedClientAsync(factory);
        AddWorkspaceContext(authenticatedClient);

        var createResponse = await anonymousClient.PostAsJsonAsync("/api/v1/mcp/oauth/device/code", new
        {
            client_id = "codex-env-mismatch",
            env_id = TestWorkspace.Id
        });
        var userCode = await ReadStringAsync(createResponse, "user_code");

        var response = await authenticatedClient.PostAsJsonAsync(
            $"/api/v1/envs/99000000-0000-0000-0000-000000000001/mcp/oauth/device/authorize",
            new { user_code = userCode });

        await Verify(response);
    }

    [Fact]
    public async Task RevokeToken_MalformedToken()
    {
        using var factory = CreateFactory(new InMemoryMcpAuthorizationStore());
        using var client = factory.CreateClient();

        var response = await client.PostAsJsonAsync(
            "/api/v1/mcp/oauth/revoke",
            new { access_token = "not-a-jwt" });

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

    private Microsoft.AspNetCore.Mvc.Testing.WebApplicationFactory<Program> CreateFactory(
        IMcpAuthorizationStore store)
    {
        var environmentService = new Mock<IEnvironmentService>();
        environmentService
            .Setup(x => x.GetResourceDescriptorAsync(It.IsAny<Guid>()))
            .ReturnsAsync((Guid envId) => new ResourceDescriptor
            {
                Organization = new IdNameKeyProps { Id = TestWorkspace.OrganizationId },
                Project = new IdNameKeyProps(),
                Environment = new IdNameKeyProps { Id = envId }
            });
        var organizationService = new Mock<IOrganizationService>();
        organizationService
            .Setup(x => x.GetAsync(TestWorkspace.OrganizationId))
            .ReturnsAsync(new Organization(TestWorkspace.Id, "Test organization", "test-org")
            {
                Id = TestWorkspace.OrganizationId,
                Initialized = true
            });

        return _app.WithServices(services =>
        {
            services.Replace(ServiceDescriptor.Scoped(_ => store));
            services.Replace(ServiceDescriptor.Scoped(_ => environmentService.Object));
            services.Replace(ServiceDescriptor.Scoped(_ => organizationService.Object));
        });
    }

    private static void AddWorkspaceContext(HttpClient client)
    {
        client.DefaultRequestHeaders.Add(Api.ApiConstants.OrgIdHeaderKey, TestWorkspace.OrganizationId.ToString());
        client.DefaultRequestHeaders.Add(Api.ApiConstants.WorkspaceHeaderKey, TestWorkspace.Id.ToString());
    }
}

public class InMemoryMcpAuthorizationStore : IMcpAuthorizationStore
{
    private const int DeviceCodeLifetimeMinutes = 10;
    private const int RefreshTokenLifetimeDays = 30;

    private readonly ConcurrentDictionary<string, McpDeviceAuthorization> _deviceAuthorizationsByHash = new();
    private readonly ConcurrentDictionary<string, string> _deviceCodeHashByUserCode = new(StringComparer.OrdinalIgnoreCase);
    private readonly ConcurrentDictionary<string, McpRefreshAuthorization> _refreshAuthorizationsByHash = new();
    private readonly ConcurrentDictionary<string, McpAccessTokenSession> _accessTokenSessions = new();

    public Task<(McpDeviceAuthorization Authorization, string DeviceCode)> CreateDeviceAuthorizationAsync(
        string clientId,
        Guid envId,
        Guid? experimentId)
    {
        CleanupExpired();

        var result = McpDeviceAuthorization.Create(
            clientId,
            envId,
            experimentId,
            DateTime.UtcNow.AddMinutes(DeviceCodeLifetimeMinutes));

        _deviceAuthorizationsByHash[result.Authorization.DeviceCodeHash] = result.Authorization;
        _deviceCodeHashByUserCode[result.Authorization.UserCode] = result.Authorization.DeviceCodeHash;

        return Task.FromResult(result);
    }

    public Task<McpDeviceAuthorization?> FindDeviceAuthorizationByDeviceCodeAsync(string deviceCode)
    {
        CleanupExpired();

        var hash = McpToken.Hash(deviceCode);
        _deviceAuthorizationsByHash.TryGetValue(hash, out var authorization);

        return Task.FromResult(authorization);
    }

    public Task<McpDeviceAuthorization?> FindDeviceAuthorizationByUserCodeAsync(string userCode)
    {
        CleanupExpired();

        if (!_deviceCodeHashByUserCode.TryGetValue(userCode, out var hash))
        {
            return Task.FromResult<McpDeviceAuthorization?>(null);
        }

        _deviceAuthorizationsByHash.TryGetValue(hash, out var authorization);

        return Task.FromResult(authorization);
    }

    public Task ApproveDeviceAuthorizationAsync(
        McpDeviceAuthorization authorization,
        Guid userId,
        Guid organizationId,
        Guid workspaceId)
    {
        authorization.Approve(userId, organizationId, workspaceId);
        return Task.CompletedTask;
    }

    public Task RemoveDeviceAuthorizationAsync(McpDeviceAuthorization authorization)
    {
        _deviceAuthorizationsByHash.TryRemove(authorization.DeviceCodeHash, out _);
        _deviceCodeHashByUserCode.TryRemove(authorization.UserCode, out _);

        return Task.CompletedTask;
    }

    public Task<string> CreateRefreshTokenAsync(McpDeviceAuthorization authorization)
    {
        CleanupExpired();

        var (refreshAuthorization, refreshToken) = McpRefreshAuthorization.Create(
            authorization.ClientId,
            authorization.ApprovedUserId!.Value,
            authorization.ApprovedOrganizationId!.Value,
            authorization.ApprovedWorkspaceId!.Value,
            authorization.EnvId,
            authorization.ExperimentId,
            DateTime.UtcNow.AddDays(RefreshTokenLifetimeDays));

        _refreshAuthorizationsByHash[refreshAuthorization.TokenHash] = refreshAuthorization;

        return Task.FromResult(refreshToken);
    }

    public Task<string> CreateAccessTokenSessionAsync(McpDeviceAuthorization authorization, DateTime expiresAt)
    {
        var session = McpAccessTokenSession.Create(
            authorization.ClientId,
            authorization.ApprovedUserId!.Value,
            authorization.ApprovedOrganizationId!.Value,
            authorization.ApprovedWorkspaceId!.Value,
            expiresAt);

        _accessTokenSessions[session.TokenId] = session;

        return Task.FromResult(session.TokenId);
    }

    public Task<string> CreateAccessTokenSessionAsync(McpRefreshAuthorization authorization, DateTime expiresAt)
    {
        var session = McpAccessTokenSession.Create(
            authorization.ClientId,
            authorization.UserId,
            authorization.OrganizationId,
            authorization.WorkspaceId,
            expiresAt);

        _accessTokenSessions[session.TokenId] = session;

        return Task.FromResult(session.TokenId);
    }

    public Task<(string RefreshToken, McpRefreshAuthorization Authorization)?> RotateRefreshTokenAsync(
        string refreshToken,
        string clientId)
    {
        CleanupExpired();

        var hash = McpToken.Hash(refreshToken);
        if (!_refreshAuthorizationsByHash.TryGetValue(hash, out var authorization) ||
            authorization.ClientId != clientId)
        {
            return Task.FromResult<(string RefreshToken, McpRefreshAuthorization Authorization)?>(null);
        }

        var nextRefreshToken = McpToken.NewToken(McpRefreshAuthorization.RefreshTokenByteCount);
        var nextAuthorization = authorization.Rotate(
            nextRefreshToken,
            DateTime.UtcNow.AddDays(RefreshTokenLifetimeDays));

        _refreshAuthorizationsByHash.TryRemove(hash, out _);
        _refreshAuthorizationsByHash[nextAuthorization.TokenHash] = nextAuthorization;

        return Task.FromResult<(string RefreshToken, McpRefreshAuthorization Authorization)?>(
            (nextRefreshToken, nextAuthorization));
    }

    public Task<bool> IsAccessTokenRevokedAsync(string tokenId)
    {
        CleanupExpired();

        return Task.FromResult(
            _accessTokenSessions.TryGetValue(tokenId, out var session) &&
            session.RevokedAt != null);
    }

    public Task<bool> IsAccessTokenActiveAsync(string tokenId)
    {
        CleanupExpired();

        return Task.FromResult(
            _accessTokenSessions.TryGetValue(tokenId, out var session) &&
            session.RevokedAt == null &&
            session.ExpiresAt > DateTime.UtcNow);
    }

    public Task<bool> RevokeAccessTokenAsync(string tokenId)
    {
        CleanupExpired();
        if (!_accessTokenSessions.TryGetValue(tokenId, out var session))
        {
            return Task.FromResult(false);
        }

        session.Revoke();

        return Task.FromResult(true);
    }

    private void CleanupExpired()
    {
        var now = DateTime.UtcNow;

        foreach (var authorization in _deviceAuthorizationsByHash.Values.Where(x => x.ExpiresAt <= now))
        {
            _deviceAuthorizationsByHash.TryRemove(authorization.DeviceCodeHash, out _);
            _deviceCodeHashByUserCode.TryRemove(authorization.UserCode, out _);
        }

        foreach (var tokenHash in _refreshAuthorizationsByHash
                     .Where(x => x.Value.ExpiresAt <= now)
                     .Select(x => x.Key))
        {
            _refreshAuthorizationsByHash.TryRemove(tokenHash, out _);
        }

        foreach (var tokenId in _accessTokenSessions
                     .Where(x => x.Value.ExpiresAt <= now)
                     .Select(x => x.Key))
        {
            _accessTokenSessions.TryRemove(tokenId, out _);
        }
    }
}
