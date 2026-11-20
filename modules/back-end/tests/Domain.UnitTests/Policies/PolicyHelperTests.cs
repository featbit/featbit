using Domain.Policies;
using Domain.Resources;

namespace Domain.UnitTests.Policies;

public class PolicyHelperTests
{
    [Theory]
    [InlineData("internal,copyable", "internal*copyable")]
    [InlineData("copyable;internal", "copyable*internal")]
    [InlineData("copyable:env/other", "copyable*other")]
    [InlineData("internal%2Ccopyable", "internal%2Ccopyable")]
    public void IsAllowed_EncodedTagMatchingDeny_OverridesOwnerGrant(string tag, string pattern)
    {
        var owner = Statement(ResourceTypes.All, EffectType.Allow, ["*"], ["*"]);
        var deny = Statement(ResourceTypes.FeatureFlag, EffectType.Deny, ["*"],
            [$"project/p:env/e:flag/*;{pattern}"]);
        var resourceRn = RN.ForFlag("p", "e", "f", [tag]);

        Assert.False(PolicyHelper.IsAllowed([owner, deny], resourceRn, Permissions.CopyFlagTo));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData(" \t\r\n")]
    public void IsAllowed_BlankResourceDeniedEvenWithOwnerGrant(string? resourceRn)
    {
        var owner = Statement(ResourceTypes.All, EffectType.Allow, ["*"], ["*"]);

        Assert.False(PolicyHelper.IsAllowed([owner], resourceRn!, Permissions.ViewEnvSecret));
    }

    [Fact]
    public void IsMatch_WildcardActionAndResource_MatchesConcreteCheck()
    {
        var statement = Statement(
            ResourceTypes.Env,
            EffectType.Allow,
            ["*"],
            ["project/prod:env/*"]);

        var matched = PolicyHelper.IsMatch(statement, "project/prod:env/dev", Permissions.DeleteEnv);

        Assert.True(matched);
    }

    [Fact]
    public void IsAllowed_MatchingDenyOverridesAllow()
    {
        var allow = Statement(
            ResourceTypes.Env,
            EffectType.Allow,
            ["*"],
            ["project/prod:env/*"]);
        var deny = Statement(
            ResourceTypes.Env,
            EffectType.Deny,
            [Permissions.DeleteEnv],
            ["project/prod:env/dev"]);

        var granted = PolicyHelper.IsAllowed(
            [allow, deny],
            "project/prod:env/dev",
            Permissions.DeleteEnv);

        Assert.False(granted);
    }

    [Fact]
    public void IsMatch_AllResourceType_PreservesExistingAuthorizationSemantics()
    {
        var statement = Statement(ResourceTypes.All, EffectType.Allow, [], []);

        var matched = PolicyHelper.IsMatch(statement, "project/prod:env/dev", Permissions.DeleteEnv);

        Assert.True(matched);
    }

    private static PolicyStatement Statement(
        string resourceType,
        string effect,
        ICollection<string> actions,
        ICollection<string> resources) => new()
    {
        Id = Guid.NewGuid().ToString(),
        ResourceType = resourceType,
        Effect = effect,
        Actions = actions,
        Resources = resources
    };
}
