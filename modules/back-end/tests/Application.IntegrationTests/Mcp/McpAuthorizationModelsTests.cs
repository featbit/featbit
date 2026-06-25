using Domain.Mcp;

namespace Application.IntegrationTests.Mcp;

public class McpAuthorizationModelsTests
{
    [Fact]
    public void DeviceAuthorizationStoresOnlyHashedDeviceCode()
    {
        var (authorization, deviceCode) = McpDeviceAuthorization.Create(
            "client-1",
            Guid.NewGuid(),
            Guid.NewGuid(),
            DateTime.UtcNow.AddMinutes(10));

        Assert.NotEmpty(deviceCode);
        Assert.NotEqual(deviceCode, authorization.DeviceCodeHash);
        Assert.Equal(McpToken.Hash(deviceCode), authorization.DeviceCodeHash);
        Assert.Matches("^[A-Z2-9]{4}-[A-Z2-9]{4}$", authorization.UserCode);
    }

    [Fact]
    public void RefreshAuthorizationStoresOnlyHashedRefreshToken()
    {
        var (authorization, refreshToken) = McpRefreshAuthorization.Create(
            "client-1",
            Guid.NewGuid(),
            Guid.NewGuid(),
            Guid.NewGuid(),
            Guid.NewGuid(),
            null,
            DateTime.UtcNow.AddDays(30));

        Assert.NotEmpty(refreshToken);
        Assert.NotEqual(refreshToken, authorization.TokenHash);
        Assert.Equal(McpToken.Hash(refreshToken), authorization.TokenHash);
    }

    [Fact]
    public void AccessTokenSessionCanBeRevoked()
    {
        var session = McpAccessTokenSession.Create(
            "client-1",
            Guid.NewGuid(),
            Guid.NewGuid(),
            Guid.NewGuid(),
            DateTime.UtcNow.AddMinutes(5));

        session.Revoke();

        Assert.NotNull(session.RevokedAt);
    }
}
