using Domain.Targeting;

namespace Domain.FeatureFlags;

public record OnOffDiff(
    bool Source,
    bool Target,
    bool IsDifferent
);

public record VariationUsers(
    Variation Variation,
    ICollection<string> Users
);

public record IndividualTargetingDiff(
    VariationUsers Source,
    VariationUsers Target,
    bool IsDifferent
);

public record TargetingRuleDiff(
    TargetRule Source,
    TargetRule Target,
    bool IsDifferent
)
{
    /// <summary>
    /// Whether the source rule can be appended because the target flag has no equivalent rule.
    /// </summary>
    public bool CanAppend { get; init; }

    /// <summary>
    /// Whether the source rule has an equivalent paired target rule, but no equivalent rule at the same position.
    /// </summary>
    public bool IsOrderDifferent { get; init; }
}

public record DefaultRuleDiff(
    Fallthrough Source,
    Fallthrough Target,
    bool IsDifferent
);

public record OffVariationDiff(
    Variation Source,
    Variation Target,
    bool IsDifferent
);

public record FlagDiff(
    OnOffDiff OnOffState,
    ICollection<IndividualTargetingDiff> IndividualTargeting,
    ICollection<TargetingRuleDiff> TargetingRule,
    DefaultRuleDiff DefaultRule,
    OffVariationDiff OffVariation
);
