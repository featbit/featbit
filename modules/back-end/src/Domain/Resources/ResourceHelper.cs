using System.Text.RegularExpressions;

namespace Domain.Resources;

public static class ResourceHelper
{
    public static string GetRn(string resourceType)
    {
        return resourceType switch
        {
            ResourceTypes.Workspace => "workspace/*",
            ResourceTypes.Iam => "iam/*",
            ResourceTypes.Project => "project/*",
            ResourceTypes.Env => "project/*:env/*",
            ResourceTypes.FeatureFlag => "project/*:env/*:flag/*",
            ResourceTypes.Segment => "project/*:env/*:segment/*",
            _ => string.Empty
        };
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