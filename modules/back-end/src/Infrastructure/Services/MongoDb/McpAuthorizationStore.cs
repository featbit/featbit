using Domain.Mcp;
using MongoDB.Driver;
using MongoDB.Driver.Linq;

namespace Infrastructure.Services.MongoDb;

public class McpAuthorizationStore(MongoDbClient mongoDb) : IMcpAuthorizationStore
{
    private const int DeviceCodeLifetimeMinutes = 10;
    private const int RefreshTokenLifetimeDays = 30;

    private IMongoCollection<McpDeviceAuthorization> DeviceAuthorizations =>
        mongoDb.CollectionOf<McpDeviceAuthorization>();

    private IMongoCollection<McpRefreshAuthorization> RefreshAuthorizations =>
        mongoDb.CollectionOf<McpRefreshAuthorization>();

    private IMongoCollection<McpAccessTokenSession> AccessTokenSessions =>
        mongoDb.CollectionOf<McpAccessTokenSession>();

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

        await DeviceAuthorizations.InsertOneAsync(result.Authorization);

        return result;
    }

    public async Task<McpDeviceAuthorization?> FindDeviceAuthorizationByDeviceCodeAsync(string deviceCode)
    {
        await CleanupExpiredAsync();

        var hash = McpToken.Hash(deviceCode);
        return await DeviceAuthorizations
            .AsQueryable()
            .FirstOrDefaultAsync(x => x.DeviceCodeHash == hash);
    }

    public async Task<McpDeviceAuthorization?> FindDeviceAuthorizationByUserCodeAsync(string userCode)
    {
        await CleanupExpiredAsync();

        var normalized = userCode.Trim().ToUpperInvariant();
        return await DeviceAuthorizations
            .AsQueryable()
            .FirstOrDefaultAsync(x => x.UserCode == normalized);
    }

    public async Task ApproveDeviceAuthorizationAsync(
        McpDeviceAuthorization authorization,
        Guid userId,
        Guid organizationId,
        Guid workspaceId)
    {
        authorization.Approve(userId, organizationId, workspaceId);
        await DeviceAuthorizations.ReplaceOneAsync(x => x.Id == authorization.Id, authorization);
    }

    public async Task RemoveDeviceAuthorizationAsync(McpDeviceAuthorization authorization)
    {
        await DeviceAuthorizations.DeleteOneAsync(x => x.Id == authorization.Id);
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

        await RefreshAuthorizations.InsertOneAsync(refreshAuthorization);

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

        await AccessTokenSessions.InsertOneAsync(session);

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

        await AccessTokenSessions.InsertOneAsync(session);

        return session.TokenId;
    }

    public async Task<(string RefreshToken, McpRefreshAuthorization Authorization)?> RotateRefreshTokenAsync(
        string refreshToken,
        string clientId)
    {
        await CleanupExpiredAsync();

        var hash = McpToken.Hash(refreshToken);
        var authorization = await RefreshAuthorizations
            .AsQueryable()
            .FirstOrDefaultAsync(x => x.TokenHash == hash && x.ClientId == clientId);
        if (authorization == null)
        {
            return null;
        }

        var nextRefreshToken = McpToken.NewToken(McpRefreshAuthorization.RefreshTokenByteCount);
        var nextAuthorization = authorization.Rotate(
            nextRefreshToken,
            DateTime.UtcNow.AddDays(RefreshTokenLifetimeDays));

        await RefreshAuthorizations.DeleteOneAsync(x => x.Id == authorization.Id);
        await RefreshAuthorizations.InsertOneAsync(nextAuthorization);

        return (nextRefreshToken, nextAuthorization);
    }

    public async Task<bool> IsAccessTokenRevokedAsync(string tokenId)
    {
        await CleanupExpiredAsync();

        return await AccessTokenSessions
            .AsQueryable()
            .AnyAsync(x => x.TokenId == tokenId && x.RevokedAt != null);
    }

    public async Task<bool> IsAccessTokenActiveAsync(string tokenId)
    {
        await CleanupExpiredAsync();

        return await AccessTokenSessions
            .AsQueryable()
            .AnyAsync(x => x.TokenId == tokenId && x.RevokedAt == null && x.ExpiresAt > DateTime.UtcNow);
    }

    public async Task<bool> RevokeAccessTokenAsync(string tokenId)
    {
        await CleanupExpiredAsync();

        var update = Builders<McpAccessTokenSession>.Update
            .Set(x => x.RevokedAt, DateTime.UtcNow)
            .Set(x => x.UpdatedAt, DateTime.UtcNow);
        var result = await AccessTokenSessions.UpdateOneAsync(x => x.TokenId == tokenId, update);

        return result.ModifiedCount > 0;
    }

    private async Task CleanupExpiredAsync()
    {
        var now = DateTime.UtcNow;

        await DeviceAuthorizations.DeleteManyAsync(x => x.ExpiresAt <= now);
        await RefreshAuthorizations.DeleteManyAsync(x => x.ExpiresAt <= now);
        await AccessTokenSessions.DeleteManyAsync(x => x.ExpiresAt <= now);
    }
}
