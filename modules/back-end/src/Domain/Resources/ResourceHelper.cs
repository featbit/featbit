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
        }

        return string.Empty;
    }

    public static bool IsRnMatchPattern(string rn, string pattern)
    {
        string EscapeRegex(string s)
        {
            return Regex.Replace(s, "([.*+?^=!:${}()|\\[\\]\\\\/])", "\\$1");
        }

        var matchPattern = pattern
            .Split('*')
            .Select(EscapeRegex)
            .Aggregate((x, y) => $"{x}.*{y}");

        var regex = new Regex($"^{matchPattern}$");
        return regex.IsMatch(rn);
    }
}