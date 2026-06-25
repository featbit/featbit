using Domain.Workspaces;

namespace Domain.UnitTests.Workspaces;

public class LicenseTests
{
    private const string ValidIssuer = "https://www.featbit.co";

    private static License NewValidLicense(Guid workspaceId) => new()
    {
        WsId = workspaceId,
        Issuer = ValidIssuer,
        Exp = DateTimeOffset.UtcNow.AddDays(1).ToUnixTimeMilliseconds()
    };

    [Fact]
    public void IsValid_AllChecksPass_ReturnsTrue()
    {
        var workspaceId = Guid.NewGuid();

        Assert.True(NewValidLicense(workspaceId).IsValid(workspaceId));
    }

    [Fact]
    public void IsValid_WorkspaceIdMismatch_ReturnsFalse()
    {
        var license = NewValidLicense(Guid.NewGuid());

        Assert.False(license.IsValid(Guid.NewGuid()));
    }

    [Fact]
    public void IsValid_UnknownIssuer_ReturnsFalse()
    {
        var workspaceId = Guid.NewGuid();
        var license = NewValidLicense(workspaceId);
        license.Issuer = "https://impostor.example.com";

        Assert.False(license.IsValid(workspaceId));
    }

    [Fact]
    public void IsValid_ExpiredLicense_ReturnsFalse()
    {
        var workspaceId = Guid.NewGuid();
        var license = NewValidLicense(workspaceId);
        license.Exp = DateTimeOffset.UtcNow.AddDays(-1).ToUnixTimeMilliseconds();

        Assert.False(license.IsValid(workspaceId));
    }
}
