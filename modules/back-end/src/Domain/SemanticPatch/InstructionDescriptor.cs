using Domain.FeatureFlags;
using Domain.Segments;
using Domain.Targeting;

namespace Domain.SemanticPatch;

public static class InstructionDescriptor
{
    public static string Describe(Instruction instruction, FeatureFlag origin, FeatureFlag current)
    {
        var change = instruction.Kind switch
        {
            FlagInstructionKind.TurnFlagOn => $"Turn on flag: {current.Name}",
            FlagInstructionKind.TurnFlagOff => $"Turn off flag: {current.Name}",

            FlagInstructionKind.ArchiveFlag => $"Archive flag: {current.Name}",
            FlagInstructionKind.RestoreFlag => $"Restore flag: {current.Name}",

            FlagInstructionKind.UpdateDisabledVariation => instruction.Value is string disabledVariationId
                ? $"Disabled variation updated to '{current.Variations.FirstOrDefault(v => v.Id == disabledVariationId)?.Name}'"
                : string.Empty,

            // VariationChanged 
            FlagInstructionKind.AddVariation => instruction.Value is Variation variation
                ? $"Add variation: {variation.Name}"
                : string.Empty,
            FlagInstructionKind.RemoveVariation => instruction.Value is string variationId
                ? $"Remove variation: {origin.Variations.FirstOrDefault(v => v.Id == variationId)?.Name}"
                : string.Empty,
            FlagInstructionKind.UpdateVariation => instruction.Value is Variation variationToUpdate
                ? $"Variation updated to '{variationToUpdate.Name}' with value '{variationToUpdate.Value}'"
                : string.Empty,
            FlagInstructionKind.UpdateVariationType => instruction.Value is string variationType
                ? $"Variation type updated to '{variationType}'"
                : string.Empty,

            // DefaultRuleChanged
            FlagInstructionKind.UpdateDefaultRuleVariationOrRollouts => "Update default rule variation",
            FlagInstructionKind.UpdateDefaultRuleDispatchKey => "Update default rule dispatch key",

            // TargetUsersChanged
            FlagInstructionKind.AddTargetUsers
                or FlagInstructionKind.RemoveTargetUsers
                or FlagInstructionKind.SetTargetUsers => TargetUserChangedDescription(),

            // TargetingRulesChanged
            FlagInstructionKind.AddRule => instruction.Value is TargetRule rule
                ? $"Add rule: {rule.Name}"
                : string.Empty,
            FlagInstructionKind.RemoveRule => instruction.Value is string ruleId
                ? $"Remove rule: {origin.Rules.FirstOrDefault(r => r.Id == ruleId)?.Name}"
                : string.Empty,
            FlagInstructionKind.SetRules => instruction.Value is ICollection<TargetRule> rules
                ? rules.Count == 0 ? "Clear rules" : $"Set rules: {string.Join(',', rules.Select(r => r.Name))}"
                : string.Empty,
            FlagInstructionKind.UpdateRuleName
                or FlagInstructionKind.UpdateRuleDispatchKey
                or FlagInstructionKind.AddRuleConditions
                or FlagInstructionKind.RemoveRuleConditions
                or FlagInstructionKind.UpdateRuleCondition
                or FlagInstructionKind.AddValuesToRuleCondition
                or FlagInstructionKind.RemoveValuesFromRuleCondition
                or FlagInstructionKind.UpdateRuleVariationOrRollouts => instruction.Value is TheRuleId theRuleId
                    ? $"Update rule: {current.Rules.FirstOrDefault(r => r.Id == theRuleId.RuleId)?.Name}"
                    : string.Empty,

            // BasicInfoUpdated
            FlagInstructionKind.UpdateName =>
                $"Update name from {origin.Name} to {current.Name}",
            FlagInstructionKind.UpdateDescription =>
                $"Update description from {origin.Description} to {current.Description}",
            FlagInstructionKind.AddTags or FlagInstructionKind.RemoveTags =>
                $"Update tags from {string.Join(',', origin.Tags)} to {string.Join(',', current.Tags)}",

            _ => string.Empty
        };

        return change;

        string TargetUserChangedDescription()
        {
            if (instruction.Value is not TargetUser targetUser)
            {
                return string.Empty;
            }

            var variation = origin.Variations.FirstOrDefault(x => x.Id == targetUser.VariationId);
            if (variation == null)
            {
                return string.Empty;
            }

            var variationName = variation.Name;
            var description = instruction.Kind switch
            {
                FlagInstructionKind.AddTargetUsers => $"Add target users to variation '{variationName}'",
                FlagInstructionKind.RemoveTargetUsers => $"Remove target users from variation '{variationName}'",
                FlagInstructionKind.SetTargetUsers when targetUser.KeyIds.Count > 0 =>
                    $"Set target users for variation '{variationName}'",
                FlagInstructionKind.SetTargetUsers when targetUser.KeyIds.Count == 0 =>
                    $"Clear target users for variation '{variationName}'",
                _ => string.Empty
            };

            return description;
        }
    }

    public static string Describe(Instruction instruction, Segment origin, Segment current)
    {
        return instruction.Kind switch
        {
            SegmentInstructionKind.Archive => $"Archive segment: {current.Name}",
            SegmentInstructionKind.Restore => $"Restore segment: {current.Name}",

            // RulesChanged
            SegmentInstructionKind.AddRule => instruction.Value is MatchRule rule
                ? $"Add rule: {rule.Name}"
                : string.Empty,
            SegmentInstructionKind.RemoveRule => instruction.Value is string ruleId
                ? $"Remove rule: {origin.Rules.FirstOrDefault(r => r.Id == ruleId)?.Name}"
                : string.Empty,
            SegmentInstructionKind.SetRules => instruction.Value is ICollection<MatchRule> rules
                ? rules.Count == 0 ? "Clear rules" : $"Set rules: {string.Join(',', rules.Select(r => r.Name))}"
                : string.Empty,
            SegmentInstructionKind.UpdateRuleName
                or SegmentInstructionKind.AddRuleConditions
                or SegmentInstructionKind.RemoveRuleConditions
                or SegmentInstructionKind.UpdateRuleCondition
                or SegmentInstructionKind.AddValuesToRuleCondition
                or SegmentInstructionKind.RemoveValuesFromRuleCondition => instruction.Value is TheRuleId theRuleId
                    ? $"Update rule: {current.Rules.FirstOrDefault(r => r.Id == theRuleId.RuleId)?.Name}"
                    : string.Empty,

            // TargetUsersChanged
            SegmentInstructionKind.AddTargetUsersToIncluded => "Add including users",
            SegmentInstructionKind.RemoveTargetUsersFromIncluded => "Remove including users",
            SegmentInstructionKind.AddTargetUsersToExcluded => "Add excluding users",
            SegmentInstructionKind.RemoveTargetUsersFromExcluded => "Remove excluding users",

            // BasicInfoUpdated
            SegmentInstructionKind.UpdateName =>
                $"Update name from {origin.Name} to {current.Name}",
            SegmentInstructionKind.UpdateDescription =>
                $"Update description from {origin.Description} to {current.Description}",

            _ => string.Empty
        };
    }
}