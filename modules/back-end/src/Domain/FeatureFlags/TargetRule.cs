namespace Domain.FeatureFlags;

public class TargetRule
{
    public string Id { get; set; }

    public string Name { get; set; }

    public ICollection<RuleItem> RuleItems { get; set; }

    public bool IsIncludedInExpt { get; set; } = true;

    public ICollection<Variation> Variations { get; set; }
}