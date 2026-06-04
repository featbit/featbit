using System.Collections.Concurrent;
using System.Security.Cryptography;

namespace Api.Mcp;

public class McpDeviceAuthorizationStore
{
    private readonly ConcurrentDictionary<string, McpDeviceAuthorization> _byDeviceCode = new();
    private readonly ConcurrentDictionary<string, string> _deviceCodeByUserCode = new(StringComparer.OrdinalIgnoreCase);
    private readonly ConcurrentDictionary<string, McpRefreshAuthorization> _refreshTokens = new();
    private readonly ConcurrentDictionary<string, McpAccessAuthorization> _accessTokens = new();

    public McpDeviceAuthorization Create(string clientId, Guid envId, Guid? experimentId)
    {
        CleanupExpired();

        var authorization = new McpDeviceAuthorization
        {
            ClientId = clientId,
            DeviceCode = NewToken(32),
            UserCode = NewUserCode(),
            EnvId = envId,
            ExperimentId = experimentId,
            ExpiresAt = DateTime.UtcNow.AddMinutes(10)
        };

        _byDeviceCode[authorization.DeviceCode] = authorization;
        _deviceCodeByUserCode[authorization.UserCode] = authorization.DeviceCode;

        return authorization;
    }

    public McpDeviceAuthorization? FindByDeviceCode(string deviceCode)
    {
        CleanupExpired();
        return _byDeviceCode.TryGetValue(deviceCode, out var authorization)
            ? authorization
            : null;
    }

    public McpDeviceAuthorization? FindByUserCode(string userCode)
    {
        CleanupExpired();
        return _deviceCodeByUserCode.TryGetValue(userCode, out var deviceCode)
            ? FindByDeviceCode(deviceCode)
            : null;
    }

    public void Remove(McpDeviceAuthorization authorization)
    {
        _byDeviceCode.TryRemove(authorization.DeviceCode, out _);
        _deviceCodeByUserCode.TryRemove(authorization.UserCode, out _);
    }

    public string CreateRefreshToken(McpDeviceAuthorization authorization)
    {
        CleanupExpired();

        var refreshToken = NewToken(32);
        _refreshTokens[refreshToken] = new McpRefreshAuthorization
        {
            ClientId = authorization.ClientId,
            UserId = authorization.ApprovedUserId!.Value,
            OrganizationId = authorization.ApprovedOrganizationId!.Value,
            WorkspaceId = authorization.ApprovedWorkspaceId!.Value,
            EnvId = authorization.EnvId,
            ExperimentId = authorization.ExperimentId,
            ExpiresAt = DateTime.UtcNow.AddDays(7)
        };

        return refreshToken;
    }

    public string CreateAccessTokenSession(McpDeviceAuthorization authorization, DateTime expiresAt)
    {
        return CreateAccessTokenSession(
            authorization.ClientId,
            authorization.ApprovedUserId!.Value,
            authorization.ApprovedOrganizationId!.Value,
            authorization.ApprovedWorkspaceId!.Value,
            expiresAt);
    }

    public string CreateAccessTokenSession(McpRefreshAuthorization authorization, DateTime expiresAt)
    {
        return CreateAccessTokenSession(
            authorization.ClientId,
            authorization.UserId,
            authorization.OrganizationId,
            authorization.WorkspaceId,
            expiresAt);
    }

    public bool IsAccessTokenActive(string tokenId)
    {
        CleanupExpired();
        return _accessTokens.TryGetValue(tokenId, out var authorization) &&
               authorization.RevokedAt == null &&
               authorization.ExpiresAt > DateTime.UtcNow;
    }

    public bool RevokeAccessToken(string tokenId)
    {
        CleanupExpired();
        if (!_accessTokens.TryGetValue(tokenId, out var authorization))
        {
            return false;
        }

        _accessTokens[tokenId] = authorization with { RevokedAt = DateTime.UtcNow };
        return true;
    }

    public (string RefreshToken, McpRefreshAuthorization Authorization)? RotateRefreshToken(
        string refreshToken,
        string clientId)
    {
        CleanupExpired();

        if (!_refreshTokens.TryRemove(refreshToken, out var authorization))
        {
            return null;
        }

        if (authorization.ClientId != clientId)
        {
            return null;
        }

        var nextRefreshToken = NewToken(32);
        _refreshTokens[nextRefreshToken] = authorization with
        {
            ExpiresAt = DateTime.UtcNow.AddDays(7)
        };

        return (nextRefreshToken, authorization);
    }

    private void CleanupExpired()
    {
        var now = DateTime.UtcNow;
        foreach (var authorization in _byDeviceCode.Values.Where(x => x.ExpiresAt <= now))
        {
            Remove(authorization);
        }

        foreach (var refreshToken in _refreshTokens.Where(x => x.Value.ExpiresAt <= now).Select(x => x.Key))
        {
            _refreshTokens.TryRemove(refreshToken, out _);
        }

        foreach (var tokenId in _accessTokens
                     .Where(x => x.Value.ExpiresAt <= now || x.Value.RevokedAt != null)
                     .Select(x => x.Key))
        {
            _accessTokens.TryRemove(tokenId, out _);
        }
    }

    private string CreateAccessTokenSession(
        string clientId,
        Guid userId,
        Guid organizationId,
        Guid workspaceId,
        DateTime expiresAt)
    {
        CleanupExpired();

        var tokenId = NewToken(24);
        _accessTokens[tokenId] = new McpAccessAuthorization
        {
            TokenId = tokenId,
            ClientId = clientId,
            UserId = userId,
            OrganizationId = organizationId,
            WorkspaceId = workspaceId,
            ExpiresAt = expiresAt
        };

        return tokenId;
    }

    private static string NewUserCode()
    {
        Span<byte> bytes = stackalloc byte[8];
        RandomNumberGenerator.Fill(bytes);

        const string alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        var chars = bytes
            .ToArray()
            .Select(x => alphabet[x % alphabet.Length])
            .ToArray();

        return $"{new string(chars[..4])}-{new string(chars[4..])}";
    }

    private static string NewToken(int byteCount)
    {
        var bytes = new byte[byteCount];
        RandomNumberGenerator.Fill(bytes);
        return Convert.ToBase64String(bytes)
            .TrimEnd('=')
            .Replace('+', '-')
            .Replace('/', '_');
    }
}

public record McpRefreshAuthorization
{
    public required string ClientId { get; init; }

    public Guid UserId { get; init; }

    public Guid OrganizationId { get; init; }

    public Guid WorkspaceId { get; init; }

    public Guid EnvId { get; init; }

    public Guid? ExperimentId { get; init; }

    public DateTime ExpiresAt { get; init; }
}

public record McpAccessAuthorization
{
    public required string TokenId { get; init; }

    public required string ClientId { get; init; }

    public Guid UserId { get; init; }

    public Guid OrganizationId { get; init; }

    public Guid WorkspaceId { get; init; }

    public DateTime ExpiresAt { get; init; }

    public DateTime? RevokedAt { get; init; }
}

public class McpDeviceAuthorization
{
    public required string ClientId { get; init; }

    public required string DeviceCode { get; init; }

    public required string UserCode { get; init; }

    public Guid EnvId { get; init; }

    public Guid? ExperimentId { get; init; }

    public DateTime ExpiresAt { get; init; }

    public bool IsApproved { get; private set; }

    public Guid? ApprovedUserId { get; private set; }

    public Guid? ApprovedOrganizationId { get; private set; }

    public Guid? ApprovedWorkspaceId { get; private set; }

    public void Approve(Guid userId, Guid organizationId, Guid workspaceId)
    {
        IsApproved = true;
        ApprovedUserId = userId;
        ApprovedOrganizationId = organizationId;
        ApprovedWorkspaceId = workspaceId;
    }
}
