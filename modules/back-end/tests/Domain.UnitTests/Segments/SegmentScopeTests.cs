using Domain.Policies;
using Domain.Resources;
using Domain.Segments;

namespace Domain.UnitTests.Segments;

public class SegmentScopeTests
{
    [Theory]
    [InlineData("organization/o", true)]
    [InlineData("organization/o:project/p", true)]
    [InlineData("organization/o:project/p:env/e", true)]
    [InlineData("project/p:env/e", false)]
    [InlineData("organization/o:env/e", false)]
    [InlineData("organization/o:project/p:env/e:segment/s", false)]
    [InlineData("organization/*", false)]
    [InlineData("organization/o;tag", false)]
    [InlineData("organization/o/extra", false)]
    [InlineData("organization/", false)]
    [InlineData(null, false)]
    public void ScopeShapeIsValidated(string? scope, bool valid)
    {
        Assert.Equal(valid, SegmentScope.IsValidScope(scope!));
    }

    [Theory]
    [InlineData("deny")]
    [InlineData("wildcard-deny")]
    public void BroadScopeCannotBypassNarrowEnvironmentDeny(string failure)
    {
        var pattern = failure == "wildcard-deny" ? "project/p*:env/e*" : "project/p:env/e";
        Assert.False(IsAllowed("project/*:env/*", Permissions.CanAccessEnv, Deny(Permissions.CanAccessEnv, pattern)));
    }

    public static IEnumerable<object[]> TaggedDenyCases =>
        from scope in new[] { "project/*:env/*", "project/p:env/*", "project/p:env/e" }
        from action in new[] { Permissions.CreateSegment, "*" }
        from tag in new[] { "protected", "prot*", "*" }
        select new object[] { scope, action, tag };

    [Theory]
    [MemberData(nameof(TaggedDenyCases))]
    public void TaggedDenyDoesNotRejectUntaggedNewSegment(string scope, string action, string tag)
    {
        Assert.True(IsAllowed(scope, Permissions.CreateSegment, Deny(action, $"project/p:env/e:segment/s;{tag}")));
    }

    public static IEnumerable<object[]> IntersectingDenyCases =>
        from scope in new[] { "project/*:env/*", "project/p:env/*", "project/p:env/e" }
        from action in new[] { Permissions.CanAccessEnv, Permissions.CreateSegment, "*" }
        from wildcard in new[] { false, true }
        let envPattern = wildcard ? "project/p*:env/e*" : "project/p:env/e"
        let pattern = action == Permissions.CanAccessEnv ? envPattern : envPattern + ":segment/s"
        select new object[] { scope, action, pattern };

    [Theory]
    [MemberData(nameof(IntersectingDenyCases))]
    public void IntersectingUntaggedDenyRejectsScope(string scope, string action, string pattern)
    {
        var requestedAction = action == "*" ? Permissions.CreateSegment : action;
        Assert.False(IsAllowed(scope, requestedAction, Deny(action, pattern)));
    }

    [Theory]
    [InlineData("project/p:env/*", "project/q:env/e:segment/s")]
    [InlineData("project/p:env/*", "project/q*:env/e*:segment/s")]
    [InlineData("project/p:env/e", "project/p:env/other:segment/s")]
    [InlineData("project/p:env/e", "project/p:env/other*:segment/s")]
    [InlineData("project/*:env/*", "project/p:env/e:segment/other")]
    [InlineData("project/p:env/*", "project/p:env/e:segment/other*")]
    public void UnrelatedResourceDenyDoesNotRejectScope(string scope, string pattern)
    {
        Assert.True(IsAllowed(scope, Permissions.CreateSegment, Deny("*", pattern)));
    }

    [Fact]
    public void UnrelatedActionDenyDoesNotRejectScope()
    {
        var deny = Deny(Permissions.UpdateSegmentName, "project/p:env/e:segment/s");
        Assert.True(IsAllowed("project/*:env/*", Permissions.CreateSegment, deny));
    }

    [Fact]
    public void TaggedDenyDoesNotHideAnotherMatchingUntaggedDeny()
    {
        var deny = Deny(Permissions.CreateSegment, "project/p:env/e:segment/s;protected");
        deny.Resources = [deny.Resources.First(), "project/p:env/e:segment/s"];
        Assert.False(IsAllowed("project/p:env/*", Permissions.CreateSegment, deny));
    }

    private static PolicyStatement Deny(string action, string pattern) => new()
    {
        ResourceType = action == Permissions.CanAccessEnv ? ResourceTypes.Env : ResourceTypes.Segment,
        Effect = EffectType.Deny, Actions = [action], Resources = [pattern]
    };

    private static bool IsAllowed(string environmentRn, string action, PolicyStatement deny)
    {
        var resourceType = action == Permissions.CanAccessEnv ? ResourceTypes.Env : ResourceTypes.Segment;
        var resourceRn = resourceType == ResourceTypes.Env ? environmentRn : $"{environmentRn}:segment/s";
        var allow = new PolicyStatement
        {
            ResourceType = resourceType,
            Effect = EffectType.Allow,
            Actions = [action],
            Resources = [resourceType == ResourceTypes.Env ? "project/*:env/*" : "project/*:env/*:segment/*"]
        };

        return SegmentScope.IsScopeAllowed([allow, deny], resourceRn, action);
    }
}
