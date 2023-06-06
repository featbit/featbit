using System.Text.RegularExpressions;

namespace Domain.Resources;

public static class ResourceHelper
{
    public static string GetRn(string resourceType)
    {
        switch (resourceType)
        {
            case ResourceTypes.FeatureFlag:
                return "project/*:env/*:flag/*";
            case ResourceTypes.Segment:
                return "project/*:env/*:segment/*";
        }

        return string.Empty;
    }

    public static bool IsRnMatchPattern(string rn, string pattern)
    {
        var matchPattern = pattern
            .Split('*')
            .Select(StringHelper.EscapeRegex)
            .Aggregate((x, y) => $"{x}.*{y}");

        var regex = new Regex($"^{matchPattern}$");
        return regex.IsMatch(rn);
    }
}