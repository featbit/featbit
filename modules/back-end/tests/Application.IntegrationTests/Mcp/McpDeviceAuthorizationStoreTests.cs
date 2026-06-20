using Api.Mcp;

namespace Application.IntegrationTests.Mcp;

public class McpDeviceAuthorizationStoreTests
{
    [Fact]
    public void CreateCanBeFoundByDeviceCodeAndUserCode()
    {
        var store = new McpDeviceAuthorizationStore();
        var envId = Guid.NewGuid();
        var experimentId = Guid.NewGuid();

        var authorization = store.Create("client-1", envId, experimentId);

        Assert.Same(authorization, store.FindByDeviceCode(authorization.DeviceCode));
        Assert.Same(authorization, store.FindByUserCode(authorization.UserCode.ToLowerInvariant()));
        Assert.Equal(envId, authorization.EnvId);
        Assert.Equal(experimentId, authorization.ExperimentId);
    }

    [Fact]
    public void RemoveClearsDeviceCodeAndUserCodeLookups()
    {
        var store = new McpDeviceAuthorizationStore();
        var authorization = store.Create("client-1", Guid.NewGuid(), null);

        store.Remove(authorization);

        Assert.Null(store.FindByDeviceCode(authorization.DeviceCode));
        Assert.Null(store.FindByUserCode(authorization.UserCode));
    }

    [Fact]
    public void RotateRefreshTokenReplacesPreviousToken()
    {
        var store = new McpDeviceAuthorizationStore();
        var authorization = store.Create("client-1", Guid.NewGuid(), Guid.NewGuid());
        authorization.Approve(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid());
        var refreshToken = store.CreateRefreshToken(authorization);

        var rotated = store.RotateRefreshToken(refreshToken, "client-1");

        Assert.NotNull(rotated);
        Assert.NotEqual(refreshToken, rotated.Value.RefreshToken);
        Assert.Null(store.RotateRefreshToken(refreshToken, "client-1"));
    }

    [Fact]
    public void RotateRefreshTokenRejectsWrongClient()
    {
        var store = new McpDeviceAuthorizationStore();
        var authorization = store.Create("client-1", Guid.NewGuid(), null);
        authorization.Approve(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid());
        var refreshToken = store.CreateRefreshToken(authorization);

        var rotated = store.RotateRefreshToken(refreshToken, "client-2");

        Assert.Null(rotated);
    }

    [Fact]
    public void RevokeAccessTokenMarksTokenRevoked()
    {
        var store = new McpDeviceAuthorizationStore();
        var authorization = store.Create("client-1", Guid.NewGuid(), null);
        authorization.Approve(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid());
        var tokenId = store.CreateAccessTokenSession(authorization, DateTime.UtcNow.AddMinutes(5));

        var revoked = store.RevokeAccessToken(tokenId);

        Assert.True(revoked);
        Assert.False(store.IsAccessTokenActive(tokenId));
        Assert.True(store.IsAccessTokenRevoked(tokenId));
    }
}
