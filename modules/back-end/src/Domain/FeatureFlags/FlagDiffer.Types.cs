using Domain.Targeting;

namespace Domain.FeatureFlags;

public record OnOffDiff(
    bool SourceOn,
    bool TargetOn,
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
);

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