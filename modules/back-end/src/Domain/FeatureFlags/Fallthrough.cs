namespace Domain.FeatureFlags;

public class Fallthrough
{
    public string DispatchKey { get; set; }

    public bool IncludedInExpt { get; set; }

    public ICollection<RolloutVariation> Variations { get; set; }
}