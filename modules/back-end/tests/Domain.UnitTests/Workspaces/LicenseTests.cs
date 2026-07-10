using Domain.Workspaces;

namespace Domain.UnitTests.Workspaces;

public class LicenseTests
{
    private const string ValidIssuer = "https://www.featbit.co";

    private static License NewValidLicense(Guid workspaceId)
    {
        return new License
        {
            WsId = workspaceId,
            Issuer = ValidIssuer,
            Exp = DateTimeOffset.UtcNow.AddDays(1).ToUnixTimeMilliseconds(),
            Features = new[] { "feature-a" }
        };
    }

    [Fact]
    public void IsValid_AllChecksPass_ReturnsTrue()
    {
        var workspaceId = Guid.NewGuid();
        var license = NewValidLicense(workspaceId);

        Assert.True(license.IsValid(workspaceId));
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

    [Fact]
    public void IsGranted_FeatureInList_ReturnsTrue()
    {
        var license = new License { Features = new[] { "feature-a", "feature-b" } };

        Assert.True(license.IsGranted("feature-a"));
    }

    [Fact]
    public void IsGranted_FeatureNotInList_ReturnsFalse()
    {
        var license = new License { Features = new[] { "feature-a" } };

        Assert.False(license.IsGranted("feature-z"));
    }

    [Fact]
    public void IsGranted_AsteriskInFeatures_GrantsAnyFeature()
    {
        var license = new License { Features = new[] { LicenseFeatures.Asterisk } };

        Assert.True(license.IsGranted("anything-at-all"));
    }
}
