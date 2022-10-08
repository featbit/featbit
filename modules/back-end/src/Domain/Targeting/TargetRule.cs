using Domain.FeatureFlags;

namespace Domain.Targeting;

public class TargetRule
{
    public string Id { get; set; }

    public string Name { get; set; }

    public bool IncludedInExpt { get; set; } = true;

    public ICollection<Condition> Conditions { get; set; } = Array.Empty<Condition>();

    public ICollection<RolloutVariation> Variations { get; set; } = Array.Empty<RolloutVariation>();
}