namespace Domain.FeatureFlags;

public class TargetRule
{
    public string Id { get; set; }

    public string Name { get; set; }

    public bool IncludedInExpt { get; set; } = true;

    public ICollection<RuleItem> RuleItems { get; set; }

    public ICollection<Variation> Variations { get; set; }
}