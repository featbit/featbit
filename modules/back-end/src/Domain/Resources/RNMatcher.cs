using System.Collections.Concurrent;
using System.Text.RegularExpressions;

namespace Domain.Resources;

public static class RNMatcher
{
    private static readonly ConcurrentDictionary<string, Regex> RegexCache = new();

    public static bool IsMatch(string resource, string pattern)
    {
        var resourceSpan = resource.AsSpan();
        var patternSpan = pattern.AsSpan();

        if (resourceSpan.Length == 0 || patternSpan.Length == 0)
        {
            // empty resource or pattern doesn't match anything (not even empty)
            return false;
        }

        // Stack-allocate Range arrays; 16 segments / 16 tags per segment is far beyond any real RN.
        Span<Range> resourceSegmentRanges = stackalloc Range[16];
        Span<Range> patternSegmentRanges = stackalloc Range[16];

        var resourceSegmentCount = resourceSpan.Split(resourceSegmentRanges, ':');
        var patternSegmentCount = patternSpan.Split(patternSegmentRanges, ':');

        if (patternSegmentCount > resourceSegmentCount)
        {
            // if pattern has more segments than resource, it can't match
            // e.g. "project/foo" doesn't match "project/foo:env/prod"
            return false;
        }

        // Reused across loop iterations; Split overwrites them each time.
        Span<Range> resourceParts = stackalloc Range[4]; // [0]=path, [1]=tags chunk
        Span<Range> patternParts = stackalloc Range[4];
        Span<Range> resourceTagRanges = stackalloc Range[16];
        Span<Range> patternTagRanges = stackalloc Range[16];

        for (var i = 0; i < patternSegmentCount; i++)
        {
            // segment example: "project/foo;tagA,tagB"
            var resourceSegment = resourceSpan[resourceSegmentRanges[i]];
            var patternSegment = patternSpan[patternSegmentRanges[i]];

            var resourcePartCount = resourceSegment.Split(resourceParts, ';');
            var patternPartCount = patternSegment.Split(patternParts, ';');

            // match path (check if pattern path matches resource path)
            var resourcePath = resourceSegment[resourceParts[0]];
            var patternPath = patternSegment[patternParts[0]];
            if (!MatchesWildcard(patternPath, resourcePath))
            {
                return false;
            }

            // if pattern doesn't have tags; no need to check resource for tags
            if (patternPartCount <= 1)
            {
                continue;
            }

            // match tag (check if any pattern tag matches any resource tag)
            var patternTagsPart = patternSegment[patternParts[1]];
            if (patternTagsPart.Length > 0)
            {
                // pattern has tags but resource doesn't → no match (e.g. "project/foo;tagA" doesn't match "project/foo")
                var resourceTagsPart = resourceSegment[resourceParts[1]];
                if (resourcePartCount <= 1 || resourceTagsPart.Length == 0)
                {
                    return false;
                }

                var patternTagCount = patternTagsPart.Split(patternTagRanges, ',');
                var resourceTagCount = resourceTagsPart.Split(resourceTagRanges, ',');

                var hit = false;
                for (var pt = 0; pt < patternTagCount && !hit; pt++)
                {
                    var patternTag = patternTagsPart[patternTagRanges[pt]];
                    for (var t = 0; t < resourceTagCount; t++)
                    {
                        if (MatchesWildcard(patternTag, resourceTagsPart[resourceTagRanges[t]]))
                        {
                            hit = true;
                            break;
                        }
                    }
                }

                if (!hit)
                {
                    return false;
                }
            }
        }

        return true;
    }

    /// <summary>
    /// Returns true if <paramref name="value"/> matches the wildcard <paramref name="pattern"/>.
    /// Uses a zero-allocation span comparison fast-path when the pattern contains no wildcards,
    /// otherwise falls back to a compiled, cached <see cref="Regex"/>.
    /// </summary>
    private static bool MatchesWildcard(ReadOnlySpan<char> pattern, ReadOnlySpan<char> value)
    {
        if (!pattern.Contains('*'))
        {
            return pattern.SequenceEqual(value);
        }

        var patternString = pattern.ToString();
        var regex = RegexCache.GetOrAdd(patternString, BuildRegex);
        return regex.IsMatch(value);
    }

    private static Regex BuildRegex(string wildcardPattern)
    {
        // for example, "foo*bar" becomes "^foo.*bar$"
        var regexPattern =
            "^" +
            string.Join(".*", wildcardPattern.Split('*').Select(Regex.Escape)) +
            "$";

        return new Regex(regexPattern, RegexOptions.Compiled);
    }
}