using Domain.FeatureFlags;

namespace Application.EndUsers;

public class EndUserFlag
{
    public string Name { get; set; }

    public string Key { get; set; }

    public string VariationType { get; set; }

    public string Variation { get; set; }

    public int VariationDisplayOrder { get; set; }

    public string MatchReason { get; set; }

    public EndUserFlag(FeatureFlag flag, UserVariation userVariation)
    {
        Name = flag.Name;
        Key = flag.Key;
        VariationType = flag.VariationType;
        Variation = userVariation.Variation.Value;
        VariationDisplayOrder = flag.Variations.ToList().FindIndex(x => x.Id == userVariation.Variation.Id) + 1;
        MatchReason = userVariation.MatchReason;
    }
}