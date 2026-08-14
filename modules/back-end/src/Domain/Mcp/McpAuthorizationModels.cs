using System.Security.Cryptography;
using System.Text;
using Domain.Bases;

namespace Domain.Mcp;

public static class McpToken
{
    private const string UserCodeAlphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

    public static string NewToken(int byteCount)
    {
        var bytes = new byte[byteCount];
        RandomNumberGenerator.Fill(bytes);
        return Convert.ToBase64String(bytes)
            .TrimEnd('=')
            .Replace('+', '-')
            .Replace('/', '_');
    }

    public static string NewUserCode()
    {
        Span<byte> bytes = stackalloc byte[8];
        RandomNumberGenerator.Fill(bytes);

        var chars = bytes
            .ToArray()
            .Select(x => UserCodeAlphabet[x % UserCodeAlphabet.Length])
            .ToArray();

        return $"{new string(chars[..4])}-{new string(chars[4..])}";
    }

    public static string Hash(string token)
    {
        var hashBytes = SHA256.HashData(Encoding.UTF8.GetBytes(token));
        var builder = new StringBuilder(hashBytes.Length * 2);
        foreach (var b in hashBytes)
        {
            builder.Append($"{b:x2}");
        }

        return builder.ToString();
    }
}

public class McpDeviceAuthorization : AuditedEntity
{
    public const int DeviceCodeByteCount = 32;

    public string ClientId { get; set; } = string.Empty;

    public string DeviceCodeHash { get; set; } = string.Empty;

    public string UserCode { get; set; } = string.Empty;

    public Guid EnvId { get; set; }

    public Guid? ExperimentId { get; set; }

    public DateTime ExpiresAt { get; set; }

    public bool IsApproved { get; set; }

    public Guid? ApprovedUserId { get; set; }

    public Guid? ApprovedOrganizationId { get; set; }

    public Guid? ApprovedWorkspaceId { get; set; }

    public static (McpDeviceAuthorization Authorization, string DeviceCode) Create(
        string clientId,
        Guid envId,
        Guid? experimentId,
        DateTime expiresAt)
    {
        var deviceCode = McpToken.NewToken(DeviceCodeByteCount);
        var authorization = new McpDeviceAuthorization
        {
            Id = Guid.NewGuid(),
            ClientId = clientId,
            DeviceCodeHash = McpToken.Hash(deviceCode),
            UserCode = McpToken.NewUserCode(),
            EnvId = envId,
            ExperimentId = experimentId,
            ExpiresAt = expiresAt
        };

        return (authorization, deviceCode);
    }

    public void Approve(Guid userId, Guid organizationId, Guid workspaceId)
    {
        IsApproved = true;
        ApprovedUserId = userId;
        ApprovedOrganizationId = organizationId;
        ApprovedWorkspaceId = workspaceId;
        UpdatedAt = DateTime.UtcNow;
    }
}

public class McpRefreshAuthorization : AuditedEntity
{
    public const int RefreshTokenByteCount = 32;

    public string TokenHash { get; set; } = string.Empty;

    public string ClientId { get; set; } = string.Empty;

    public Guid UserId { get; set; }

    public Guid OrganizationId { get; set; }

    public Guid WorkspaceId { get; set; }

    public Guid EnvId { get; set; }

    public Guid? ExperimentId { get; set; }

    public DateTime ExpiresAt { get; set; }

    public static (McpRefreshAuthorization Authorization, string RefreshToken) Create(
        string clientId,
        Guid userId,
        Guid organizationId,
        Guid workspaceId,
        Guid envId,
        Guid? experimentId,
        DateTime expiresAt)
    {
        var refreshToken = McpToken.NewToken(RefreshTokenByteCount);
        var authorization = new McpRefreshAuthorization
        {
            Id = Guid.NewGuid(),
            TokenHash = McpToken.Hash(refreshToken),
            ClientId = clientId,
            UserId = userId,
            OrganizationId = organizationId,
            WorkspaceId = workspaceId,
            EnvId = envId,
            ExperimentId = experimentId,
            ExpiresAt = expiresAt
        };

        return (authorization, refreshToken);
    }

    public McpRefreshAuthorization Rotate(string refreshToken, DateTime expiresAt)
    {
        return new McpRefreshAuthorization
        {
            Id = Guid.NewGuid(),
            TokenHash = McpToken.Hash(refreshToken),
            ClientId = ClientId,
            UserId = UserId,
            OrganizationId = OrganizationId,
            WorkspaceId = WorkspaceId,
            EnvId = EnvId,
            ExperimentId = ExperimentId,
            ExpiresAt = expiresAt
        };
    }
}

public class McpAccessTokenSession : AuditedEntity
{
    public const int TokenIdByteCount = 24;

    public string TokenId { get; set; } = string.Empty;

    public string ClientId { get; set; } = string.Empty;

    public Guid UserId { get; set; }

    public Guid OrganizationId { get; set; }

    public Guid WorkspaceId { get; set; }

    public DateTime ExpiresAt { get; set; }

    public DateTime? RevokedAt { get; set; }

    public static McpAccessTokenSession Create(
        string clientId,
        Guid userId,
        Guid organizationId,
        Guid workspaceId,
        DateTime expiresAt)
    {
        return new McpAccessTokenSession
        {
            Id = Guid.NewGuid(),
            TokenId = McpToken.NewToken(TokenIdByteCount),
            ClientId = clientId,
            UserId = userId,
            OrganizationId = organizationId,
            WorkspaceId = workspaceId,
            ExpiresAt = expiresAt
        };
    }

    public void Revoke()
    {
        RevokedAt = DateTime.UtcNow;
        UpdatedAt = DateTime.UtcNow;
    }
}
