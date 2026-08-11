using Domain.Targeting;

namespace Domain.FeatureFlags;

public class FlagTargeting
{
    /// <summary>
    /// Legacy targeting metadata retained for persisted feature-flag compatibility.
    /// </summary>
    public bool ExptIncludeAllTargets { get; set; } = true;

    /// <summary>
    /// The variation served when the feature flag is disabled.
    /// </summary>
    public string DisabledVariationId { get; set; }

    /// <summary>
    /// The list of user keys explicitly targeted by the feature flag
    /// </summary>
    public ICollection<TargetUser> TargetUsers { get; set; }

    /// <summary>
    /// The targeting rules for the feature flag
    /// </summary>
    public ICollection<TargetRule> Rules { get; set; }

    /// <summary>
    /// The default rule for the feature flag, which applies to users who do not match any of the target users or rules above.
    /// </summary>
    public Fallthrough Fallthrough { get; set; }

}
