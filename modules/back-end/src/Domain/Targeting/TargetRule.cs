using Domain.FeatureFlags;

namespace Domain.Targeting;

public class TargetRule
{
    /// <summary>
    /// Legacy targeting metadata retained for persisted feature-flag compatibility.
    /// </summary>
    public bool IncludedInExpt { get; set; }

    /// <summary>
    /// The rule ID. Usually a UUID.
    /// </summary>
    public string Id { get; set; }

    /// <summary>
    /// The name of the rule.
    /// </summary>
    public string Name { get; set; }

    /// <summary>
    /// The dispatch key for the rule.
    /// </summary>
    public string DispatchKey { get; set; }

    /// <summary>
    /// The conditions for the rule.
    /// </summary>
    public ICollection<Condition> Conditions { get; set; }

    /// <summary>
    /// The served variations.
    /// </summary>
    public ICollection<RolloutVariation> Variations { get; set; }
}
