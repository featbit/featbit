using Domain.Targeting;

namespace Domain.FeatureFlags;

public class FlagTargeting
{
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

    /// <summary>
    /// Whether all targets should be included in experiments related to this feature flag. Defaults to `true`.
    /// </summary>
    public bool ExptIncludeAllTargets { get; set; } = true;

    public bool IsValid(ICollection<Variation> flagVariations)
    {
        // flag variations not null and not empty
        if (flagVariations.IsNullOrEmpty())
        {
            return false;
        }

        // non-nulls
        if (TargetUsers == null || Rules == null || Fallthrough == null)
        {
            return false;
        }

        // validate that the disabled variation exists in the flag variations
        if (flagVariations.All(variation => variation.Id != DisabledVariationId))
        {
            return false;
        }

        // validate that all target users have valid variations
        if (TargetUsers.Any(tu => tu?.KeyIds == null || flagVariations.All(variation => variation.Id != tu.VariationId)))
        {
            return false;
        }

        // validate that all rules are valid
        if (Rules.Any(rule => rule == null || !rule.IsValid(flagVariations)))
        {
            return false;
        }

        // validate that the fallthrough variations are valid
        return ServedVariationsValidator.IsValid(Fallthrough.Variations, flagVariations);
    }
}
