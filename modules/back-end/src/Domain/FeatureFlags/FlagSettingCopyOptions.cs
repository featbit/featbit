namespace Domain.FeatureFlags;

public record FlagSettingCopyOptions(
    bool OnOffState,
    CopyIndividualTargetingOption IndividualTargeting,
    CopyTargetingRuleOption TargetingRule,
    bool DefaultRule,
    bool OffVariation
);

public record CopyIndividualTargetingOption(
    bool Copy,
    string Mode
);

public record CopyTargetingRuleOption(
    bool Copy,
    string Mode
);

public static class CopyModes
{
    public const string Overwrite = "overwrite";
    public const string Append = "append";
}