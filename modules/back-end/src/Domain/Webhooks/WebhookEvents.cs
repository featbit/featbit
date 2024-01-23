using Domain.SemanticPatch;

namespace Domain.Webhooks;

public static class WebhookEvents
{
    public static class FlagEvents
    {
        public const string Created = "feature_flag.created";
        public const string Toggled = "feature_flag.toggled";
        public const string Archived = "feature_flag.archived";
        public const string Restored = "feature_flag.restored";
        public const string VariationChanged = "feature_flag.variation_changed";
        public const string OffVariationChanged = "feature_flag.off_variation_changed";
        public const string DefaultRuleChanged = "feature_flag.default_rule_changed";
        public const string TargetUsersChanged = "feature_flag.target_users_changed";
        public const string TargetingRulesChanged = "feature_flag.targeting_rules_changed";
        public const string BasicInfoUpdated = "feature_flag.basic_info_updated";
        public const string Deleted = "feature_flag.deleted";

        public static string FromInstructionKind(string kind)
        {
            return kind switch
            {
                FlagInstructionKind.TurnFlagOn or FlagInstructionKind.TurnFlagOff => Toggled,

                FlagInstructionKind.ArchiveFlag => Archived,
                FlagInstructionKind.RestoreFlag => Restored,

                FlagInstructionKind.AddVariation
                    or FlagInstructionKind.RemoveVariation
                    or FlagInstructionKind.UpdateVariationType
                    or FlagInstructionKind.UpdateVariation
                    => VariationChanged,

                FlagInstructionKind.UpdateDisabledVariation => OffVariationChanged,

                FlagInstructionKind.UpdateDefaultRuleVariationOrRollouts
                    or FlagInstructionKind.UpdateDefaultRuleDispatchKey
                    => DefaultRuleChanged,

                FlagInstructionKind.AddTargetUsers
                    or FlagInstructionKind.RemoveTargetUsers
                    or FlagInstructionKind.SetTargetUsers
                    => TargetUsersChanged,

                FlagInstructionKind.AddRule
                    or FlagInstructionKind.RemoveRule
                    or FlagInstructionKind.SetRules
                    or FlagInstructionKind.UpdateRuleName
                    or FlagInstructionKind.UpdateRuleDispatchKey
                    or FlagInstructionKind.AddRuleConditions
                    or FlagInstructionKind.RemoveRuleConditions
                    or FlagInstructionKind.UpdateRuleCondition
                    or FlagInstructionKind.AddValuesToRuleCondition
                    or FlagInstructionKind.RemoveValuesFromRuleCondition
                    or FlagInstructionKind.UpdateRuleVariationOrRollouts
                    => TargetingRulesChanged,

                FlagInstructionKind.UpdateName
                    or FlagInstructionKind.UpdateDescription
                    or FlagInstructionKind.AddTags
                    or FlagInstructionKind.RemoveTags
                    => BasicInfoUpdated,

                _ => throw new ArgumentOutOfRangeException(nameof(kind), kind, null)
            };
        }
    }

    public static class SegmentEvents
    {
        public const string Created = "segment.created";
        public const string Archived = "segment.archived";
        public const string Restored = "segment.restored";
        public const string RulesChanged = "segment.rules_changed";
        public const string TargetUsersChanged = "segment.target_users_changed";
        public const string BasicInfoUpdated = "segment.basic_info_updated";
        public const string Deleted = "segment.deleted";

        public static string FromInstructionKind(string kind)
        {
            return kind switch
            {
                SegmentInstructionKind.Archive => Archived,
                SegmentInstructionKind.Restore => Restored,

                SegmentInstructionKind.AddRule
                    or SegmentInstructionKind.RemoveRule
                    or SegmentInstructionKind.SetRules
                    or SegmentInstructionKind.UpdateRuleName
                    or SegmentInstructionKind.AddRuleConditions
                    or SegmentInstructionKind.RemoveRuleConditions
                    or SegmentInstructionKind.UpdateRuleCondition
                    or SegmentInstructionKind.AddValuesToRuleCondition
                    or SegmentInstructionKind.RemoveValuesFromRuleCondition
                    => RulesChanged,

                SegmentInstructionKind.AddTargetUsersToIncluded
                    or SegmentInstructionKind.RemoveTargetUsersFromIncluded
                    or SegmentInstructionKind.AddTargetUsersToExcluded
                    or SegmentInstructionKind.RemoveTargetUsersFromExcluded
                    => TargetUsersChanged,

                SegmentInstructionKind.UpdateName
                    or SegmentInstructionKind.UpdateDescription
                    => BasicInfoUpdated,
                _ => throw new ArgumentOutOfRangeException(nameof(kind), kind, null)
            };
        }
    }

    public static readonly string[] All =
    {
        FlagEvents.Created,
        FlagEvents.Toggled,
        FlagEvents.Archived,
        FlagEvents.Restored,
        FlagEvents.VariationChanged,
        FlagEvents.OffVariationChanged,
        FlagEvents.DefaultRuleChanged,
        FlagEvents.TargetUsersChanged,
        FlagEvents.TargetingRulesChanged,
        FlagEvents.BasicInfoUpdated,
        FlagEvents.Deleted,

        SegmentEvents.Created,
        SegmentEvents.Archived,
        SegmentEvents.Restored,
        SegmentEvents.RulesChanged,
        SegmentEvents.TargetUsersChanged,
        SegmentEvents.BasicInfoUpdated,
        SegmentEvents.Deleted
    };
}