using Domain.Policies;
using Domain.Resources;

namespace Domain.UnitTests.Policies;

public class PolicyHelperTests
{
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
