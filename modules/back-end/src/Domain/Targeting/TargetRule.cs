using Domain.FeatureFlags;

namespace Domain.Targeting;

public class TargetRule
{
    public string Id { get; set; }

    public string Name { get; set; }

    public bool IncludedInExpt { get; set; }

    public ICollection<Condition> Conditions { get; set; }

    public ICollection<RolloutVariation> Variations { get; set; }
}