namespace Domain.FeatureFlags;

public class Fallthrough
{
    /// <summary>
    /// The dispatch key of the default rule.
    /// </summary>
    public string DispatchKey { get; set; }

    /// <summary>
    /// Whether the default rule is included in experiments.
    /// </summary>
    public bool IncludedInExpt { get; set; }

    /// <summary>
    /// The served variations.
    /// </summary>
    public ICollection<RolloutVariation> Variations { get; set; }
}