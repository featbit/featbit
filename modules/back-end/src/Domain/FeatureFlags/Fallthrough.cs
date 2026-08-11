namespace Domain.FeatureFlags;

public class Fallthrough
{
    /// <summary>
    /// Legacy targeting metadata retained for persisted feature-flag compatibility.
    /// </summary>
    public bool IncludedInExpt { get; set; }

    /// <summary>
    /// The dispatch key of the default rule.
    /// </summary>
    public string DispatchKey { get; set; }

    /// <summary>
    /// The served variations.
    /// </summary>
    public ICollection<RolloutVariation> Variations { get; set; }
}
