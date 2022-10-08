namespace Domain.FeatureFlags;

public class Fallthrough
{
    public bool IncludedInExpt { get; set; }

    public ICollection<RolloutVariation> Variations { get; set; }
}