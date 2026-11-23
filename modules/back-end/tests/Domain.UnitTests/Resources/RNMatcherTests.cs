using Domain.Resources;

namespace Domain.UnitTests.Resources;

public class RNMatcherTests
{
    // —— Exact path matching ——

    [Theory]
    [InlineData("project/foo", "project/foo", true)]
    [InlineData("project/foo", "project/bar", false)]
    [InlineData("project/foo:env/prod", "project/foo:env/prod", true)]
    [InlineData("project/foo:env/prod", "project/foo:env/staging", false)]
    public void IsMatch_ExactPathPattern_MatchesOnlyIdenticalPaths(string resource, string pattern, bool expected)
    {
        Assert.Equal(expected, RNMatcher.IsMatch(resource, pattern));
    }

    // —— Wildcard path matching ——

    [Theory]
    [InlineData("project/foo", "project/*", true)]
    [InlineData("project/foo:env/prod", "project/*:env/*", true)]
    [InlineData("project/foo:env/prod", "project/*:env/prod", true)]
    [InlineData("project/foo:env/prod:flag/dark-mode", "project/*:env/*:flag/*", true)]
    [InlineData("project/foo", "project/f*", true)]
    [InlineData("project/foo", "project/*o", true)]
    [InlineData("project/foo", "project/b*", false)]
    [InlineData("project/foo-bar", "project/f*-bar", true)]   // middle wildcard
    [InlineData("project/foo-baz", "project/f*-bar", false)]  // middle wildcard, no match
    [InlineData("project/foo-bar-baz", "project/*-*-*", true)] // multiple wildcards
    public void IsMatch_WildcardInPath_MatchesAccordingToWildcardSemantics(string resource, string pattern, bool expected)
    {
        Assert.Equal(expected, RNMatcher.IsMatch(resource, pattern));
    }

    // —— Segment count rules ——

    [Theory]
    [InlineData("project/foo:env/prod", "project/foo", true)]
    [InlineData("project/foo:env/prod:flag/x", "project/*", true)]
    [InlineData("project/foo:env/prod:flag/x", "project/foo:env/prod", true)]
    public void IsMatch_PatternHasFewerSegmentsThanResource_Matches(string resource, string pattern, bool expected)
    {
        Assert.Equal(expected, RNMatcher.IsMatch(resource, pattern));
    }

    [Theory]
    [InlineData("project/foo", "project/foo:env/prod", false)]
    [InlineData("project/foo", "project/foo:env/*", false)]
    [InlineData("env/prod", "project/foo:env/prod:flag/x", false)]
    public void IsMatch_PatternHasMoreSegmentsThanResource_DoesNotMatch(string resource, string pattern, bool expected)
    {
        Assert.Equal(expected, RNMatcher.IsMatch(resource, pattern));
    }

    // —— Tag matching ——

    [Theory]
    [InlineData("project/foo;tagA", "project/foo;tagA", true)]
    [InlineData("project/foo;tagA,tagB", "project/foo;tagA", true)]
    [InlineData("project/foo;tagA", "project/foo;tagB", false)]
    [InlineData("project/foo;tagA,tagB", "project/foo;tagC", false)]
    public void IsMatch_ExactTagPattern_MatchesWhenAnyResourceTagEqualsPatternTag(string resource, string pattern, bool expected)
    {
        Assert.Equal(expected, RNMatcher.IsMatch(resource, pattern));
    }

    [Theory]
    [InlineData("project/foo;tagA", "project/foo;*", true)]
    [InlineData("project/foo;tagA,tagB", "project/foo;tag*", true)]
    [InlineData("project/foo;production", "project/foo;prod*", true)]
    [InlineData("project/foo;staging", "project/foo;prod*", false)]
    public void IsMatch_WildcardTagPattern_MatchesUsingPrefixSemantics(string resource, string pattern, bool expected)
    {
        Assert.Equal(expected, RNMatcher.IsMatch(resource, pattern));
    }

    [Theory]
    [InlineData("project/foo;tagA", "project/foo;tagA,tagB", true)]
    [InlineData("project/foo;tagB", "project/foo;tagA,tagB", true)]
    [InlineData("project/foo;tagC", "project/foo;tagA,tagB", false)]
    // resource has multiple tags AND pattern has multiple tags
    [InlineData("project/foo;tagA,tagB", "project/foo;tagB,tagC", true)]  // tagB overlaps
    [InlineData("project/foo;tagA,tagB", "project/foo;tagC,tagD", false)] // no overlap
    public void IsMatch_MultipleTagsInPattern_MatchesWhenAnyTagOverlaps(string resource, string pattern, bool expected)
    {
        // Rule tags use OR semantics: at least one rule tag must match a source tag
        Assert.Equal(expected, RNMatcher.IsMatch(resource, pattern));
    }

    [Theory]
    [InlineData("project/foo;tagA", "project/foo", true)]
    [InlineData("project/foo;tagA,tagB", "project/*", true)]
    public void IsMatch_PatternHasNoTags_IgnoresResourceTags(string resource, string pattern, bool expected)
    {
        // When rule has no tags, tag check is skipped
        Assert.Equal(expected, RNMatcher.IsMatch(resource, pattern));
    }

    [Theory]
    [InlineData("project/foo", "project/foo;tagA", false)]
    [InlineData("project/foo", "project/*;required", false)]
    public void IsMatch_PatternRequiresTagsButResourceHasNone_DoesNotMatch(string resource, string pattern, bool expected)
    {
        // Source has no tags but rule requires them → no match
        Assert.Equal(expected, RNMatcher.IsMatch(resource, pattern));
    }

    // —— Multi-segment with tags ——

    [Theory]
    [InlineData("project/foo;dev:env/prod;us-east", "project/*;dev:env/*;us-east", true)]
    [InlineData("project/foo;dev:env/prod;eu-west", "project/*;dev:env/*;us-east", false)]
    [InlineData("project/foo;dev:env/prod;us-east", "project/*:env/*;us-east", true)]
    public void IsMatch_MultiSegmentPatternsWithTags_AppliesTagAndPathRulesPerSegment(string resource, string pattern, bool expected)
    {
        Assert.Equal(expected, RNMatcher.IsMatch(resource, pattern));
    }

    // —— Real-world RN patterns from ResourceService ——

    [Theory]
    [InlineData("project/my-proj:env/production:flag/dark-mode", "project/*", true)]
    [InlineData("project/my-proj:env/production:flag/dark-mode", "project/my-proj:env/production:flag/dark-mode", true)]
    [InlineData("project/my-proj:env/production:flag/dark-mode", "project/my-proj:env/*:flag/*", true)]
    [InlineData("project/my-proj:env/production:segment/*", "project/my-proj:env/production:segment/*", true)]
    [InlineData("project/my-proj:env/staging:flag/login", "project/my-proj:env/production:flag/*", false)]
    public void IsMatch_ResourceServiceStyleRnPatterns_MatchesAsExpected(string resource, string pattern, bool expected)
    {
        Assert.Equal(expected, RNMatcher.IsMatch(resource, pattern));
    }

    // —— Edge cases ——

    [Theory]
    [InlineData("project/foo")]
    [InlineData("anything/here")]
    [InlineData("project/foo:env/prod")]
    [InlineData("project/p:env/e:flag/f")]
    public void IsMatch_StarPattern_MatchesAnyResource(string resource)
    {
        // "*" is a single-segment pattern; the "fewer segments" rule means it also
        // matches multi-segment resources — critical for Resource.All (Rn = "*")
        Assert.True(RNMatcher.IsMatch(resource, "*"));
    }

    [Fact]
    public void IsMatch_EmptyResourceOrPattern_DoesNotMatch()
    {
        // empty source or empty rule is not a valid match
        Assert.False(RNMatcher.IsMatch("project/foo", ""));
        Assert.False(RNMatcher.IsMatch("", "project/foo"));
        Assert.False(RNMatcher.IsMatch("", ""));
    }

    [Theory]
    [InlineData("project/foo.bar", "project/foo.bar", true)]
    [InlineData("project/foo.bar", "project/foo*", true)]
    [InlineData("project/foo.bar", "project/*.bar", true)]
    public void IsMatch_PathContainsRegexMetaChars_TreatsThemAsLiterals(string resource, string pattern, bool expected)
    {
        // Dots and other regex-special chars in paths should be treated as literals
        Assert.Equal(expected, RNMatcher.IsMatch(resource, pattern));
    }

    // —— Case sensitivity ——

    [Theory]
    [InlineData("project/Foo", "project/foo", false)] // different case → no match
    [InlineData("project/Foo", "project/Foo", true)]  // same case → match
    public void IsMatch_DifferentCasingInPath_IsTreatedAsDifferentValue(string resource, string pattern, bool expected)
    {
        Assert.Equal(expected, RNMatcher.IsMatch(resource, pattern));
    }
}
