using System.Text.Json;
using System.Text.RegularExpressions;

namespace Domain.Targeting;

/// <summary>SemVer 2.0 precedence, with omitted minor and patch components defaulting to zero, including versions with suffixes.</summary>
public sealed class SemanticVersion
{
    private static readonly Regex Pattern = new(
        @"\A(0|[1-9][0-9]*)(?:\.(0|[1-9][0-9]*)(?:\.(0|[1-9][0-9]*))?)?(?:-((?:0|[1-9][0-9]*|[0-9]*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9][0-9]*|[0-9]*[A-Za-z-][0-9A-Za-z-]*))*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?\z",
        RegexOptions.CultureInvariant | RegexOptions.NonBacktracking);

    // Major, minor and patch components, e.g. "4.2" becomes ["4", "2", "0"].
    private readonly string[] versionComponents;

    // Dot-separated pre-release identifiers, e.g. "beta.1" becomes ["beta", "1"]; empty for a release without a pre-release suffix.
    private readonly string[] prereleaseIdentifiers;

    private SemanticVersion(Match match)
    {
        versionComponents = [match.Groups[1].Value,
            match.Groups[2].Success ? match.Groups[2].Value : "0",
            match.Groups[3].Success ? match.Groups[3].Value : "0"];
        prereleaseIdentifiers = match.Groups[4].Success ? match.Groups[4].Value.Split('.') : [];
    }

    public static bool TryParse(string value, out SemanticVersion version)
    {
        version = null;
        if (string.IsNullOrEmpty(value))
        {
            return false;
        }
        
        var match = Pattern.Match(value);
        if (!match.Success)
        {
            return false;
        }
        
        version = new SemanticVersion(match);
        return true;
    }

    public static bool TryParseList(string value, out SemanticVersion[] versions)
    {
        versions = [];
        if (string.IsNullOrWhiteSpace(value))
        {
            return false;
        }

        try
        {
            var values = JsonSerializer.Deserialize<string[]>(value);
            if (values == null || values.Length == 0)
            {
                return false;
            }

            var parsed = new SemanticVersion[values.Length];
            for (var i = 0; i < values.Length; i++)
            {
                if (!TryParse(values[i], out parsed[i]))
                {
                    return false;
                }
            }

            versions = parsed;
            return true;
        }
        catch (JsonException)
        {
            return false;
        }
    }

    private static int CompareNumber(string left, string right) =>
        left.Length != right.Length ? left.Length.CompareTo(right.Length) : string.CompareOrdinal(left, right);

    /// <summary>
    /// Compares this version with another version to determine which is greater.
    /// </summary>
    /// <param name="other">The non-null, parsed version to compare against.</param>
    /// <returns>
    /// Returns a negative number if this version is smaller than other,
    /// zero if they are equal, or a positive number if this version is greater than other.
    /// </returns>
    /// <remarks>
    /// Build metadata does not affect precedence: 1.0.0+build.1 and 1.0.0+build.2 compare equally.
    /// </remarks>
    public int CompareTo(SemanticVersion other)
    {
        // Compare major, minor and patch numerically, in that order. The first difference wins:
        // 2.0.0 > 1.99.99, 1.10.0 > 1.9.99, and 1.2.4 > 1.2.3.
        // Parsed numeric components have no leading zeroes, so CompareNumber can compare them
        // without converting to a fixed-width integer or risking numeric overflow.
        for (var i = 0; i < versionComponents.Length; i++)
        {
            var result = CompareNumber(versionComponents[i], other.versionComponents[i]);
            if (result != 0) return result;
        }

        // With identical major/minor/patch components, a release without a pre-release suffix
        // has higher precedence than a pre-release: 1.0.0 > 1.0.0-beta.
        // Boolean comparison uses true > false; if neither has a suffix, both are true and equal.
        if (prereleaseIdentifiers.Length == 0 || other.prereleaseIdentifiers.Length == 0)
        {
            return (prereleaseIdentifiers.Length == 0).CompareTo(other.prereleaseIdentifiers.Length == 0);
        }
            
        // Both versions have pre-release suffixes. Compare their dot-separated identifiers
        // from left to right, stopping at the first difference (e.g. "beta.2" => ["beta", "2"]).
        for (var i = 0; i < Math.Min(prereleaseIdentifiers.Length, other.prereleaseIdentifiers.Length); i++)
        {
            var left = prereleaseIdentifiers[i];
            var right = other.prereleaseIdentifiers[i];
            var leftNumeric = left.All(char.IsAsciiDigit);
            var rightNumeric = right.All(char.IsAsciiDigit);
            // Two numeric identifiers compare numerically: beta.2 < beta.10.
            // A numeric identifier has lower precedence than a non-numeric one: 1 < alpha.
            // Two non-numeric identifiers compare by ordinal character order, case-sensitively:
            // alpha < beta and A < a. Parsing restricts identifiers to ASCII letters, digits and '-'.
            var result = leftNumeric && rightNumeric ? CompareNumber(left, right)
                : leftNumeric != rightNumeric ? (leftNumeric ? -1 : 1) : string.CompareOrdinal(left, right);
            
            if (result != 0)
            {
                return result;
            }
        }
        
        // All shared identifiers are equal. The longer suffix has higher precedence:
        // 1.0.0-alpha < 1.0.0-alpha.1. Equal lengths mean equal version precedence.
        return prereleaseIdentifiers.Length.CompareTo(other.prereleaseIdentifiers.Length);
    }
}
