using System.Text.Json;
using Domain.AuditLogs;
using Domain.Segments;
using Domain.Targeting;

namespace Domain.SemanticPatch;

public class SegmentComparer
{
    public static IEnumerable<SegmentInstruction> Compare(DataChange change)
    {
        if (change.IsCreationOrDeletion())
        {
            return Array.Empty<SegmentInstruction>();
        }

        var original = JsonSerializer.Deserialize<Segment>(change.Previous, ReusableJsonSerializerOptions.Web);
        var current = JsonSerializer.Deserialize<Segment>(change.Current, ReusableJsonSerializerOptions.Web);

        return Compare(original, current);
    }

    public static IEnumerable<SegmentInstruction> Compare(Segment original, Segment current)
    {
        var instructions = new List<SegmentInstruction>();

        instructions.Add(CompareArchived(original.IsArchived, current.IsArchived));

        instructions.Add(CompareName(original.Name, current.Name));
        instructions.Add(CompareDescription(original.Description, current.Description));

        instructions.AddRange(CompareTargetUsers("included", original.Included, current.Included));
        instructions.AddRange(CompareTargetUsers("excluded", original.Excluded, current.Excluded));
        instructions.AddRange(CompareRules(original.Rules, current.Rules));

        // exclude noop instructions
        return instructions.Where(x => x.Kind != SegmentInstructionKind.Noop);
    }

    public static SegmentInstruction CompareArchived(bool original, bool current)
    {
        if (original == current)
        {
            return NoopSegmentInstruction.Instance;
        }

        var kind = current ? SegmentInstructionKind.Archive : SegmentInstructionKind.Restore;
        var instruction = new SegmentArchiveInstruction(kind);
        return instruction;
    }

    public static SegmentInstruction CompareName(string original, string current)
    {
        if (original == current)
        {
            return NoopSegmentInstruction.Instance;
        }

        var instruction = new SegmentNameInstruction(current);
        return instruction;
    }

    public static SegmentInstruction CompareDescription(string original, string current)
    {
        if (original == current)
        {
            return NoopSegmentInstruction.Instance;
        }

        var instruction = new SegmentDescriptionInstruction(current);
        return instruction;
    }

    public static IEnumerable<SegmentInstruction> CompareTargetUsers(
        string compareType,
        ICollection<string> original,
        ICollection<string> current)
    {
        if (!original.Any() && !current.Any())
        {
            return new SegmentInstruction[] { NoopSegmentInstruction.Instance };
        }

        var instructions = new List<SegmentInstruction>();

        var addedKeyIds = current.Except(original).ToList();
        var removedKeyIds = original.Except(current).ToList();

        var isCompareIncluded = compareType == "included";
        if (addedKeyIds.Any())
        {
            var kind = isCompareIncluded
                ? SegmentInstructionKind.AddTargetUsersToIncluded
                : SegmentInstructionKind.AddTargetUsersToExcluded;
            instructions.Add(new SegmentTargetUserInstruction(kind, addedKeyIds));
        }

        if (removedKeyIds.Any())
        {
            var kind = isCompareIncluded
                ? SegmentInstructionKind.RemoveTargetUsersFromIncluded
                : SegmentInstructionKind.RemoveTargetUsersFromExcluded;
            instructions.Add(new SegmentTargetUserInstruction(kind, removedKeyIds));
        }

        return instructions;
    }

    public static IEnumerable<SegmentInstruction> CompareRules(
        ICollection<MatchRule> original,
        ICollection<MatchRule> current)
    {
        // if rules are all empty
        if (!original.Any() && !current.Any())
        {
            return new[] { NoopSegmentInstruction.Instance };
        }

        // if rules are empty for only one of them
        if (!original.Any() || !current.Any())
        {
            var instruction = new SetSegmentRulesInstruction(current);
            return new SegmentInstruction[] { instruction };
        }

        var instructions = new List<SegmentInstruction>();

        var addedRules = current.ExceptBy(original.Select(v => v.Id), v => v.Id).ToArray();
        var removedRules = original.ExceptBy(current.Select(v => v.Id), v => v.Id).ToArray();
        var commonRules = original.IntersectBy(current.Select(v => v.Id), v => v.Id);

        foreach (var rule in addedRules)
        {
            instructions.Add(new AddSegmentRuleInstruction(rule));
        }

        foreach (var rule in removedRules)
        {
            instructions.Add(new RemoveSegmentRuleInstruction(rule.Id));
        }

        foreach (var rule in commonRules)
        {
            var rule1 = original.First(x => x.Id == rule.Id);
            var rule2 = current.First(x => x.Id == rule.Id);

            var ruleInstructions = CompareRule(rule1, rule2);
            instructions.AddRange(ruleInstructions);
        }

        return instructions;
    }

    public static IEnumerable<SegmentInstruction> CompareRule(MatchRule original, MatchRule current)
    {
        var ruleId = original.Id;
        var instructions = new List<SegmentInstruction>();

        // compare name
        if (original.Name != current.Name)
        {
            var value = new RuleName { RuleId = ruleId, Name = current.Name };
            instructions.Add(new SegmentRuleNameInstruction(value));
        }

        // compare added/removed conditions
        var addedConditions = current.Conditions.ExceptBy(original.Conditions.Select(v => v.Id), v => v.Id)
            .ToArray();
        var removedConditions = original.Conditions.ExceptBy(current.Conditions.Select(v => v.Id), v => v.Id)
            .Select(x => x.Id)
            .ToArray();

        if (removedConditions.Any())
        {
            var conditionIds = new RuleConditionIds { RuleId = ruleId, ConditionIds = removedConditions };
            instructions.Add(new SegmentRemoveConditionsInstruction(conditionIds));
        }

        if (addedConditions.Any())
        {
            var conditions = new RuleConditions { RuleId = ruleId, Conditions = addedConditions };
            instructions.Add(new SegmentAddConditionsInstruction(conditions));
        }

        // compare same id conditions
        var commonConditions = original.Conditions.IntersectBy(current.Conditions.Select(v => v.Id), v => v.Id);
        foreach (var condition in commonConditions)
        {
            var condition1 = original.Conditions.First(v => v.Id == condition.Id);
            var condition2 = current.Conditions.First(v => v.Id == condition.Id);

            var conditionInstructions = CompareCondition(ruleId, condition1, condition2);
            instructions.AddRange(conditionInstructions);
        }

        return instructions;
    }

    public static IEnumerable<SegmentInstruction> CompareCondition(string ruleId, Condition original, Condition current)
    {
        var instructions = new List<SegmentInstruction>();

        // for segment condition, we just need compare values
        if (original.Property == current.Property &&
            SegmentConsts.ConditionProperties.Contains(original.Property) &&
            original.Value != current.Value)
        {
            CompareConditionValues();
            return instructions;
        }

        // for multiValueOps, we just need compare values
        var multiValueOps = new[] { OperatorTypes.IsOneOf, OperatorTypes.NotOneOf };
        if (original.Property == current.Property &&
            original.Op == current.Op &&
            multiValueOps.Contains(original.Op) &&
            original.Value != current.Value)
        {
            CompareConditionValues();
            return instructions;
        }

        // for any other changes
        if (!original.ValueEquals(current))
        {
            var condition = new RuleCondition { RuleId = ruleId, Condition = current };
            instructions.Add(new SegmentUpdateConditionInstruction(condition));
        }

        return instructions;

        void CompareConditionValues()
        {
            var originalValues = JsonSerializer.Deserialize<List<string>>(original.Value);
            var currentValues = JsonSerializer.Deserialize<List<string>>(current.Value);

            var removedValues = originalValues.Except(currentValues).ToArray();
            var addedValues = currentValues.Except(originalValues).ToArray();

            if (removedValues.Any())
            {
                var conditionValues = new RuleConditionValues
                {
                    RuleId = ruleId,
                    ConditionId = current.Id,
                    Values = removedValues
                };

                var instruction = new SegmentRemoveValuesFromConditionInstruction(conditionValues);
                instructions.Add(instruction);
            }

            if (addedValues.Any())
            {
                var conditionValues = new RuleConditionValues
                {
                    RuleId = ruleId,
                    ConditionId = current.Id,
                    Values = addedValues
                };

                var instruction = new SegmentAddValuesToConditionInstruction(conditionValues);
                instructions.Add(instruction);
            }
        }
    }
}