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

            case ResourceTypes.Project:
                return "project/*";
        }

        return string.Empty;
    }

    public static bool IsRnMatchPattern(string rn, string rule)
    {
        string EscapeRegex(string s) => Regex.Escape(s);

        Regex WildcardToRegex(string pattern)
        {
            var regexPattern = "^" + 
                string.Join(".*", pattern.Split('*').Select(EscapeRegex)) + 
                "$";
            return new Regex(regexPattern);
        }

        (string Path, string[] Tags) ParseSegment(string segment)
        {
            var parts = segment.Split(';');
            var path = parts[0];
            var tags = parts.Length > 1 && !string.IsNullOrEmpty(parts[1])
                ? parts[1].Split(',')
                : Array.Empty<string>();
            return (path, tags);
        }

        (string Path, string[] Tags)[] ParseSegments(string input)
        {
            return input.Split(':')
                .Select(ParseSegment)
                .ToArray();
        }

        var strSegments = ParseSegments(rn);
        var ruleSegments = ParseSegments(rule);

        if (ruleSegments.Length > strSegments.Length)
        {
            return false;
        }

        for (int i = 0; i < ruleSegments.Length; i++)
        {
            var (rulePath, ruleTags) = ruleSegments[i];
            var (strPath, strTags) = strSegments[i];

            // —— path match (support *) ——
            var pathRegex = WildcardToRegex(rulePath);
            if (!pathRegex.IsMatch(strPath))
            {
                return false;
            }

            // —— tag match (support *, OR) ——
            if (ruleTags.Length > 0)
            {
                bool hit = false;

                foreach (var ruleTag in ruleTags)
                {
                    var tagRegex = WildcardToRegex(ruleTag);

                    if (strTags.Any(strTag => tagRegex.IsMatch(strTag)))
                    {
                        hit = true;
                        break;
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
}