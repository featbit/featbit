using Domain.Mcp;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Services.EntityFrameworkCore;

public class McpAuthorizationStore(AppDbContext dbContext) : IMcpAuthorizationStore
{
    private const int DeviceCodeLifetimeMinutes = 10;
    private const int RefreshTokenLifetimeDays = 30;

    public async Task<(McpDeviceAuthorization Authorization, string DeviceCode)> CreateDeviceAuthorizationAsync(
        string clientId,
        Guid envId,
        Guid? experimentId)
    {
        await CleanupExpiredAsync();

        var result = McpDeviceAuthorization.Create(
            clientId,
            envId,
            experimentId,
            DateTime.UtcNow.AddMinutes(DeviceCodeLifetimeMinutes));

        dbContext.Set<McpDeviceAuthorization>().Add(result.Authorization);
        await dbContext.SaveChangesAsync();

        return result;
    }

    public async Task<McpDeviceAuthorization?> FindDeviceAuthorizationByDeviceCodeAsync(string deviceCode)
    {
        await CleanupExpiredAsync();

        var hash = McpToken.Hash(deviceCode);
        return await dbContext
            .Set<McpDeviceAuthorization>()
            .FirstOrDefaultAsync(x => x.DeviceCodeHash == hash);
    }

    public async Task<McpDeviceAuthorization?> FindDeviceAuthorizationByUserCodeAsync(string userCode)
    {
        await CleanupExpiredAsync();

        var normalized = userCode.Trim().ToUpperInvariant();
        return await dbContext
            .Set<McpDeviceAuthorization>()
            .FirstOrDefaultAsync(x => x.UserCode == normalized);
    }

    public async Task ApproveDeviceAuthorizationAsync(
        McpDeviceAuthorization authorization,
        Guid userId,
        Guid organizationId,
        Guid workspaceId)
    {
        authorization.Approve(userId, organizationId, workspaceId);
        await dbContext.SaveChangesAsync();
    }

    public async Task RemoveDeviceAuthorizationAsync(McpDeviceAuthorization authorization)
    {
        dbContext.Set<McpDeviceAuthorization>().Remove(authorization);
        await dbContext.SaveChangesAsync();
    }

    public async Task<string> CreateRefreshTokenAsync(McpDeviceAuthorization authorization)
    {
        await CleanupExpiredAsync();

        var (refreshAuthorization, refreshToken) = McpRefreshAuthorization.Create(
            authorization.ClientId,
            authorization.ApprovedUserId!.Value,
            authorization.ApprovedOrganizationId!.Value,
            authorization.ApprovedWorkspaceId!.Value,
            authorization.EnvId,
            authorization.ExperimentId,
            DateTime.UtcNow.AddDays(RefreshTokenLifetimeDays));

        dbContext.Set<McpRefreshAuthorization>().Add(refreshAuthorization);
        await dbContext.SaveChangesAsync();

        return refreshToken;
    }

    public async Task<string> CreateAccessTokenSessionAsync(McpDeviceAuthorization authorization, DateTime expiresAt)
    {
        var session = McpAccessTokenSession.Create(
            authorization.ClientId,
            authorization.ApprovedUserId!.Value,
            authorization.ApprovedOrganizationId!.Value,
            authorization.ApprovedWorkspaceId!.Value,
            expiresAt);

        dbContext.Set<McpAccessTokenSession>().Add(session);
        await dbContext.SaveChangesAsync();

        return session.TokenId;
    }

    public async Task<string> CreateAccessTokenSessionAsync(McpRefreshAuthorization authorization, DateTime expiresAt)
    {
        var session = McpAccessTokenSession.Create(
            authorization.ClientId,
            authorization.UserId,
            authorization.OrganizationId,
            authorization.WorkspaceId,
            expiresAt);

        dbContext.Set<McpAccessTokenSession>().Add(session);
        await dbContext.SaveChangesAsync();

        return session.TokenId;
    }

    public async Task<(string RefreshToken, McpRefreshAuthorization Authorization)?> RotateRefreshTokenAsync(
        string refreshToken,
        string clientId)
    {
        await CleanupExpiredAsync();

        var hash = McpToken.Hash(refreshToken);
        var authorization = await dbContext
            .Set<McpRefreshAuthorization>()
            .FirstOrDefaultAsync(x => x.TokenHash == hash && x.ClientId == clientId);
        if (authorization == null)
        {
            return null;
        }

        var nextRefreshToken = McpToken.NewToken(McpRefreshAuthorization.RefreshTokenByteCount);
        var nextAuthorization = authorization.Rotate(
            nextRefreshToken,
            DateTime.UtcNow.AddDays(RefreshTokenLifetimeDays));

        dbContext.Set<McpRefreshAuthorization>().Remove(authorization);
        dbContext.Set<McpRefreshAuthorization>().Add(nextAuthorization);
        await dbContext.SaveChangesAsync();

        return (nextRefreshToken, nextAuthorization);
    }

    public async Task<bool> IsAccessTokenRevokedAsync(string tokenId)
    {
        await CleanupExpiredAsync();

        return await dbContext
            .Set<McpAccessTokenSession>()
            .AnyAsync(x => x.TokenId == tokenId && x.RevokedAt != null);
    }

    public async Task<bool> IsAccessTokenActiveAsync(string tokenId)
    {
        await CleanupExpiredAsync();

        return await dbContext
            .Set<McpAccessTokenSession>()
            .AnyAsync(x => x.TokenId == tokenId && x.RevokedAt == null && x.ExpiresAt > DateTime.UtcNow);
    }

    public async Task<bool> RevokeAccessTokenAsync(string tokenId)
    {
        await CleanupExpiredAsync();

        var session = await dbContext
            .Set<McpAccessTokenSession>()
            .FirstOrDefaultAsync(x => x.TokenId == tokenId);
        if (session == null)
        {
            return false;
        }

        session.Revoke();
        await dbContext.SaveChangesAsync();

        return true;
    }

    private async Task CleanupExpiredAsync()
    {
        var now = DateTime.UtcNow;

        await dbContext
            .Set<McpDeviceAuthorization>()
            .Where(x => x.ExpiresAt <= now)
            .ExecuteDeleteAsync();

        await dbContext
            .Set<McpRefreshAuthorization>()
            .Where(x => x.ExpiresAt <= now)
            .ExecuteDeleteAsync();

        await dbContext
            .Set<McpAccessTokenSession>()
            .Where(x => x.ExpiresAt <= now)
            .ExecuteDeleteAsync();
    }
}
