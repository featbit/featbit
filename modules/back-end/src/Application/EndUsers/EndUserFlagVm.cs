using Domain.FeatureFlags;

namespace Application.EndUsers;

public class EndUserFlagVm
{
    public string Name { get; set; }

    public string Key { get; set; }

    public ICollection<Variation> Variations { get; set; }

    public string VariationType { get; set; }

    public string MatchVariation { get; set; }

    public string MatchReason { get; set; }

    public EndUserFlagVm(FeatureFlag flag, UserVariation userVariation)
    {
        Name = flag.Name;
        Key = flag.Key;
        Variations = flag.Variations;
        VariationType = flag.VariationType;
        MatchVariation = userVariation.Variation.Value;
        MatchReason = userVariation.MatchReason;
    }
}