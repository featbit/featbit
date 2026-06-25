#nullable enable

using Domain.Mcp;

namespace Application.Services;

public interface IMcpAuthorizationStore
{
    Task<(McpDeviceAuthorization Authorization, string DeviceCode)> CreateDeviceAuthorizationAsync(
        string clientId,
        Guid envId,
        Guid? experimentId);

    Task<McpDeviceAuthorization?> FindDeviceAuthorizationByDeviceCodeAsync(string deviceCode);

    Task<McpDeviceAuthorization?> FindDeviceAuthorizationByUserCodeAsync(string userCode);

    Task ApproveDeviceAuthorizationAsync(
        McpDeviceAuthorization authorization,
        Guid userId,
        Guid organizationId,
        Guid workspaceId);

    Task RemoveDeviceAuthorizationAsync(McpDeviceAuthorization authorization);

    Task<string> CreateRefreshTokenAsync(McpDeviceAuthorization authorization);

    Task<string> CreateAccessTokenSessionAsync(McpDeviceAuthorization authorization, DateTime expiresAt);

    Task<string> CreateAccessTokenSessionAsync(McpRefreshAuthorization authorization, DateTime expiresAt);

    Task<(string RefreshToken, McpRefreshAuthorization Authorization)?> RotateRefreshTokenAsync(
        string refreshToken,
        string clientId);

    Task<bool> IsAccessTokenRevokedAsync(string tokenId);

    Task<bool> IsAccessTokenActiveAsync(string tokenId);

    Task<bool> RevokeAccessTokenAsync(string tokenId);
}
