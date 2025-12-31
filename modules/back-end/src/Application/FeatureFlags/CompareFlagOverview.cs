using Domain.FeatureFlags;

namespace Application.FeatureFlags;

public class CompareFlagOverview(FeatureFlag flag)
{
    public Guid Id { get; set; } = flag.Id;

    public string Name { get; set; } = flag.Name;

    public string Key { get; set; } = flag.Key;

    public string Description { get; set; } = flag.Description;

    public string[] Tags { get; set; } = flag.Tags?.ToArray() ?? [];

    public List<FlagDiffOverview> Diffs { get; set; } = [];

    public void AddDiff(Guid targetEnvId, FlagDiff diff)
    {
        var diffOverview = new FlagDiffOverview(targetEnvId, diff);
        Diffs.Add(diffOverview);
    }
}