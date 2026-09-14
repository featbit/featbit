using System.Globalization;

namespace Infrastructure.Services;

internal static class ExperimentRunNumber
{
    public const string CreationTitlePrefix = "New experiment run created: ";

    public static long LastUsed(IEnumerable<string> slugs, IEnumerable<string> creationTitles)
    {
        var historicalSlugs = creationTitles
            .Where(title => title.StartsWith(CreationTitlePrefix, StringComparison.Ordinal))
            .Select(title => title[CreationTitlePrefix.Length..]);

        return slugs.Concat(historicalSlugs)
            .Where(slug => slug.StartsWith("run-", StringComparison.OrdinalIgnoreCase))
            .Select(slug => long.TryParse(slug.AsSpan(4), NumberStyles.None, CultureInfo.InvariantCulture, out var number)
                ? number
                : 0)
            .DefaultIfEmpty(0)
            .Max();
    }
}
