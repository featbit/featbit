using Domain.FeatureFlags;

namespace Application.EndUsers;

public class EndUserFlagVm
{
    public string Name { get; set; }

    public string Key { get; set; }

    public string VariationType { get; set; }

    public string Variation { get; set; }

    public int VariationDisplayOrder { get; set; }

    public string MatchReason { get; set; }

    public EndUserFlagVm(FeatureFlag flag, UserVariation userVariation)
    {
        Name = flag.Name;
        Key = flag.Key;
        VariationType = flag.VariationType;
        Variation = userVariation.Variation.Value;
        VariationDisplayOrder = flag.Variations.ToList().FindIndex(x => x.Id == userVariation.Variation.Id) + 1;
        MatchReason = userVariation.MatchReason;
    }
}