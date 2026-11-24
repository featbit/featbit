using System.Text.Json;
using System.Text.RegularExpressions;

namespace Domain.Targeting;

/// <summary>SemVer 2.0 precedence, with plain major.minor accepted as major.minor.0.</summary>
public sealed class SemanticVersion
{
    public const int MaxLength = 256;
    public const int MaxValues = 100;
    private static readonly Regex Pattern = new(
        @"\A(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)(?:\.(0|[1-9][0-9]*)(?:-((?:0|[1-9][0-9]*|[0-9]*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9][0-9]*|[0-9]*[A-Za-z-][0-9A-Za-z-]*))*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?)?\z",
        RegexOptions.CultureInvariant | RegexOptions.NonBacktracking);

    private readonly string[] core;
    private readonly string[] prerelease;

    private SemanticVersion(Match match)
    {
        core = [match.Groups[1].Value, match.Groups[2].Value,
            match.Groups[3].Success ? match.Groups[3].Value : "0"];
        prerelease = match.Groups[4].Success ? match.Groups[4].Value.Split('.') : [];
    }

    public static bool TryParse(string value, out SemanticVersion version)
    {
        version = null;
        if (string.IsNullOrEmpty(value) || value.Length > MaxLength) return false;
        var match = Pattern.Match(value);
        if (!match.Success) return false;
        version = new SemanticVersion(match);
        return true;
    }

    public static bool TryParseList(string value, out SemanticVersion[] versions)
    {
        versions = [];
        if (value == null || value.Length > MaxValues * (MaxLength * 6 + 3) + 1) return false;
        try
        {
            var values = JsonSerializer.Deserialize<string[]>(value);
            if (values == null || values.Length is < 1 or > MaxValues) return false;
            var parsed = new SemanticVersion[values.Length];
            for (var i = 0; i < values.Length; i++)
                if (!TryParse(values[i], out parsed[i])) return false;
            versions = parsed;
            return true;
        }
        catch (JsonException) { return false; }
    }

    private static int CompareNumber(string left, string right) =>
        left.Length != right.Length ? left.Length.CompareTo(right.Length) : string.CompareOrdinal(left, right);

    public int CompareTo(SemanticVersion other)
    {
        for (var i = 0; i < core.Length; i++)
        {
            var result = CompareNumber(core[i], other.core[i]);
            if (result != 0) return result;
        }
        if (prerelease.Length == 0 || other.prerelease.Length == 0)
            return (prerelease.Length == 0).CompareTo(other.prerelease.Length == 0);
        for (var i = 0; i < Math.Min(prerelease.Length, other.prerelease.Length); i++)
        {
            var left = prerelease[i];
            var right = other.prerelease[i];
            var leftNumeric = left.All(char.IsAsciiDigit);
            var rightNumeric = right.All(char.IsAsciiDigit);
            var result = leftNumeric && rightNumeric ? CompareNumber(left, right)
                : leftNumeric != rightNumeric ? (leftNumeric ? -1 : 1) : string.CompareOrdinal(left, right);
            if (result != 0) return result;
        }
        return prerelease.Length.CompareTo(other.prerelease.Length);
    }
}
