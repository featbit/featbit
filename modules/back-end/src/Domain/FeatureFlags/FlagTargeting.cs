using Domain.Targeting;

namespace Domain.FeatureFlags;

public class FlagTargeting
{
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

    /// <summary>
    /// Whether all targets should be included in experiments related to this feature flag. Defaults to `true`.
    /// </summary>
    public bool ExptIncludeAllTargets { get; set; } = true;
}