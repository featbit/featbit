using System.Collections.Concurrent;
using Application.Services;
using Domain.Mcp;

namespace Application.IntegrationTests;

public class TestMcpAuthorizationStore : IMcpAuthorizationStore
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
