using Domain.Policies;
using Domain.Resources;

namespace Domain.Segments;

public static class SegmentScope
{
    public static bool IsValidScope(string scope) => TryGetScopeDepth(scope, out _);

    public static bool IsValidEnvironmentScope(string scope) =>
        TryGetScopeDepth(scope, out var depth) && depth == 3;

    private static bool TryGetScopeDepth(string scope, out int depth)
    {
        depth = 0;
        if (!RN.TryParse(scope, out var parsed))
        {
            return false;
        }

        var parts = parsed.ToArray();
        string[] types = [ResourceTypes.Organization, ResourceTypes.Project, ResourceTypes.Env];
        if (parts.Length == 0 || parts.Length > types.Length)
        {
            return false;
        }

        for (var index = 0; index < parts.Length; index++)
        {
            var part = parts[index];
            if (part.Type != types[index] || string.IsNullOrWhiteSpace(part.Key) ||
                part.Key.Any(c => c is '*' or ';' or '/' || char.IsWhiteSpace(c)))
            {
                return false;
            }
        }

        depth = parts.Length;
        return true;
    }

    // A broad sharing scope must not bypass a deny on one of its narrower environments.
    public static bool IsScopeAllowed(PolicyStatement[] policies, string rn, string action)
    {
        if (!PolicyHelper.IsAllowed(policies, rn, action))
        {
            return false;
        }

        var hasIntersectingDeny = policies
            .Where(policy => policy.Effect == EffectType.Deny)
            .Where(policy => policy.Actions.Any(a => a == "*" || a == action))
            .Any(policy => policy.Resources.Any(pattern => Intersects(rn, pattern)));

        return !hasIntersectingDeny;

        static bool Intersects(string rn, string denyPattern)
        {
            var scopeParts = rn.Split(':');
            var denyParts = denyPattern.Split(':');
            if (denyParts.Length > scopeParts.Length) return false;
            for (var index = 0; index < denyParts.Length; index++)
            {
                var scopePart = scopeParts[index];
                var denyPart = denyParts[index];
                var scopePath = scopePart.Split(';')[0];
                var denyPath = denyPart.Split(';')[0];
                // Generated scope paths contain only concrete keys or a whole-key '*'.
                if (!RNMatcher.IsMatch(scopePath, denyPath) && !RNMatcher.IsMatch(denyPath, scopePath))
                    return false;

                // Match deny tags only against the resource's tags, never in reverse.
                // Reusing the scope path here isolates tag matching from path overlap.
                var tagStart = denyPart.IndexOf(';');
                if (tagStart >= 0 && !RNMatcher.IsMatch(scopePart, scopePath + denyPart[tagStart..]))
                    return false;
            }
            return true;
        }
    }
}
