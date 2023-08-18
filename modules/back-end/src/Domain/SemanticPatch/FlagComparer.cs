using System.Text.Json;
using Domain.FeatureFlags;
using Domain.Segments;
using Domain.Targeting;

namespace Domain.SemanticPatch;

public static class FlagComparer
{
    public static IEnumerable<FlagInstruction> Compare(FeatureFlag original, FeatureFlag current)
    {
        var instructions = new List<FlagInstruction>();

        instructions.Add(CompareStatus(original.IsEnabled, current.IsEnabled));
        instructions.Add(CompareArchived(original.IsArchived, current.IsArchived));

        instructions.Add(CompareName(original.Name, current.Name));
        instructions.Add(CompareDescription(original.Description, current.Description));
        instructions.AddRange(CompareTags(original.Tags, current.Tags));

        instructions.Add(CompareVariationType(original.VariationType, current.VariationType));
        instructions.AddRange(CompareVariations(original.Variations, current.Variations));

        instructions.Add(CompareDisabledVariation(original.DisabledVariationId, current.DisabledVariationId));

        instructions.AddRange(CompareFallthrough(original.Fallthrough, current.Fallthrough));
        instructions.AddRange(CompareTargetUsers(current.Variations, original.TargetUsers, current.TargetUsers));
        instructions.AddRange(CompareRules(original.Rules, current.Rules));

        // exclude noop instructions
        instructions.RemoveAll(x => x.Kind == FlagInstructionKind.Noop);

        return instructions;
    }

    public static FlagInstruction CompareStatus(bool original, bool current)
    {
        if (original == current)
        {
            return NoopFlagInstruction.Instance;
        }

        var kind = current ? FlagInstructionKind.TurnFlagOn : FlagInstructionKind.TurnFlagOff;
        var instruction = new StatusInstruction(kind);
        return instruction;
    }

    public static FlagInstruction CompareArchived(bool original, bool current)
    {
        if (original == current)
        {
            return NoopFlagInstruction.Instance;
        }

        var kind = current ? FlagInstructionKind.ArchiveFlag : FlagInstructionKind.RestoreFlag;
        var instruction = new ArchiveInstruction(kind);
        return instruction;
    }

    public static FlagInstruction CompareName(string original, string current)
    {
        if (original == current)
        {
            return NoopFlagInstruction.Instance;
        }

        var instruction = new NameInstruction(current);
        return instruction;
    }

    public static FlagInstruction CompareDescription(string original, string current)
    {
        if (original == current)
        {
            return NoopFlagInstruction.Instance;
        }

        var instruction = new DescriptionInstruction(current);
        return instruction;
    }

    public static IEnumerable<FlagInstruction> CompareTags(ICollection<string> original, ICollection<string> current)
    {
        var removedTags = original.Except(current).ToArray();
        var addedTags = current.Except(original).ToArray();

        var instructions = new List<FlagInstruction>();
        if (removedTags.Any())
        {
            instructions.Add(new TagsInstruction(FlagInstructionKind.RemoveTags, removedTags));
        }

        if (addedTags.Any())
        {
            instructions.Add(new TagsInstruction(FlagInstructionKind.AddTags, addedTags));
        }

        return instructions;
    }

    public static FlagInstruction CompareVariationType(string original, string current)
    {
        if (original == current)
        {
            return NoopFlagInstruction.Instance;
        }

        var instruction = new VariationTypeInstruction(current);
        return instruction;
    }

    public static IEnumerable<FlagInstruction> CompareVariations(ICollection<Variation> original, ICollection<Variation> current)
    {
        var removedVariations = original.ExceptBy(current.Select(v => v.Id), v => v.Id);
        var addedVariations = current.ExceptBy(original.Select(v => v.Id), v => v.Id);
        var commonVariations = original.IntersectBy(current.Select(v => v.Id), v => v.Id);

        var instructions = new List<FlagInstruction>();

        instructions.AddRange(removedVariations.Select(v => new RemoveVariationInstruction(v.Id)));
        instructions.AddRange(addedVariations.Select(v =>
        {
            // TODO: Why we need to assign a new id here?
            v.Id = Guid.NewGuid().ToString();
            return new AddVariationInstruction(v);
        }));

        foreach (var variation in commonVariations)
        {
            var oldVariation = original.First(v => v.Id == variation.Id);
            var newVariation = current.First(v => v.Id == variation.Id);

            if (!oldVariation.Equals(newVariation))
            {
                instructions.Add(new UpdateVariationInstruction(newVariation));
            }
        }

        return instructions;
    }

    public static FlagInstruction CompareDisabledVariation(string original, string current)
    {
        if (original == current)
        {
            return NoopFlagInstruction.Instance;
        }

        var instruction = new DisabledVariationInstruction(current);
        return instruction;
    }

    // TODO: refactor this method
    public static IEnumerable<FlagInstruction> CompareFallthrough(Fallthrough original, Fallthrough current)
    {
        var instructions = new List<FlagInstruction>();

        var isFallThroughChanged = original.DispatchKey != current.DispatchKey;
        if (!isFallThroughChanged && original.Variations.Count != current.Variations.Count)
        {
            isFallThroughChanged = true;
        }

        if (!isFallThroughChanged)
        {
            var removedVariations =
                original.Variations.ExceptBy(current.Variations.Select(v => v.Id), v => v.Id);
            var addedVariations =
                current.Variations.ExceptBy(original.Variations.Select(v => v.Id), v => v.Id);

            if (removedVariations.Any() || addedVariations.Any())
            {
                isFallThroughChanged = true;
            }
            else
            {
                const double tolerance = 0.001;
                isFallThroughChanged = original.Variations.Any(v1 =>
                {
                    var isRolloutChanged = false;
                    foreach (var v2 in current.Variations)
                    {
                        if (Math.Abs(v1.Rollout[0] - v2.Rollout[0]) > tolerance ||
                            Math.Abs(v1.Rollout[1] - v2.Rollout[1]) > tolerance) // rollout is different
                        {
                            isRolloutChanged = true;
                            break;
                        }
                    }

                    return isRolloutChanged;
                });
            }
        }

        if (isFallThroughChanged)
        {
            instructions.Add(new DefaultVariationInstruction(current));
        }

        return instructions;
    }

    // TODO: need review
    public static IEnumerable<FlagInstruction> CompareTargetUsers(
        ICollection<Variation> flagVariations, 
        ICollection<TargetUser> original, 
        ICollection<TargetUser> current)
    {
        var instructions = new List<FlagInstruction>();

        foreach (var variation in flagVariations)
        {
            var targetUser1 = original.FirstOrDefault(x => x.VariationId == variation.Id);
            var targetUser2 = current.FirstOrDefault(x => x.VariationId == variation.Id);

            var differs = CompareTargetUser(variation.Id, targetUser1, targetUser2);
            instructions.AddRange(differs);
        }

        return instructions;
    }

    // TODO: need review
    public static IEnumerable<FlagInstruction> CompareTargetUser(string variationId, TargetUser original,TargetUser current)
    {
        if (original == null && current == null)
        {
            return new FlagInstruction[] { NoopFlagInstruction.Instance };
        }

        if (original == null)
        {
            var targetUser = new TargetUser { VariationId = variationId, KeyIds = current.KeyIds };
            var instruction = new TargetUsersInstruction(FlagInstructionKind.SetTargetUsers, targetUser);

            return new FlagInstruction[] { instruction };
        }

        if (current == null)
        {
            var targetUser = new TargetUser { VariationId = variationId, KeyIds = Array.Empty<string>() };
            var instruction = new TargetUsersInstruction(FlagInstructionKind.SetTargetUsers, targetUser);

            return new FlagInstruction[] { instruction };
        }

        var differs = new List<FlagInstruction>();

        var addedKeyIds = current.KeyIds.Except(original.KeyIds ?? Array.Empty<string>()).ToArray();
        var removedKeyIds = original.KeyIds.Except(current.KeyIds ?? Array.Empty<string>()).ToArray();

        if (addedKeyIds.Any())
        {
            var targetUser = new TargetUser { VariationId = variationId, KeyIds = addedKeyIds };
            differs.Add(new TargetUsersInstruction(FlagInstructionKind.AddTargetUsers, targetUser));
        }

        if (removedKeyIds.Any())
        {
            var targetUser = new TargetUser { VariationId = variationId, KeyIds = removedKeyIds };
            differs.Add(new TargetUsersInstruction(FlagInstructionKind.RemoveTargetUsers, targetUser));
        }

        return differs;
    }

    public static IEnumerable<FlagInstruction> CompareRules(ICollection<TargetRule> original, ICollection<TargetRule> current)
    {
        // if rules are all empty
        if (!original.Any() && !current.Any())
        {
            return new[] { NoopFlagInstruction.Instance };
        }

        // TODO: need review
        // if rules are empty for one of them
        if (!original.Any() || current.Any())
        {
            var instruction = new SetRulesInstruction(current);
            return new FlagInstruction[] { instruction };
        }

        var instructions = new List<FlagInstruction>();

        var addedRules = current.ExceptBy(original.Select(v => v.Id), v => v.Id).ToArray();
        var removedRules = original.ExceptBy(current.Select(v => v.Id), v => v.Id).ToArray();
        var commonRules = original.IntersectBy(current.Select(v => v.Id), v => v.Id);

        foreach (var rule in addedRules)
        {
            instructions.Add(new AddRuleInstruction(rule));
        }

        foreach (var rule in removedRules)
        {
            instructions.Add(new RemoveRuleInstruction(rule.Id));
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

    public static IEnumerable<FlagInstruction> CompareRule(TargetRule original, TargetRule current)
    {
        var ruleId = original.Id;
        var instructions = new List<FlagInstruction>();

        // compare name
        if (original.Name != current.Name)
        {
            var value = new RuleName { RuleId = ruleId, Name = current.Name };
            instructions.Add(new RuleNameInstruction(value));
        }

        // compare dispatch key
        if (original.DispatchKey != current.DispatchKey)
        {
            var value = new RuleDispatchKey { RuleId = ruleId, DispatchKey = current.DispatchKey };
            instructions.Add(new RuleDispatchKeyInstruction(value));
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
            instructions.Add(new RemoveConditionsInstruction(conditionIds));
        }

        if (addedConditions.Any())
        {
            var conditions = new RuleConditions { RuleId = ruleId, Conditions = addedConditions };
            instructions.Add(new AddConditionsInstruction(conditions));
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

        // compare rule rollout
        var removedRollouts = original.Variations.ExceptBy(current.Variations.Select(v => v.Id), v => v.Id);
        var addedRollouts = current.Variations.ExceptBy(original.Variations.Select(v => v.Id), v => v.Id);

        bool isRolloutsChanged;
        if (removedRollouts.Any() || addedRollouts.Any())
        {
            isRolloutsChanged = true;
        }
        else
        {
            const double tolerance = 0.001;
            isRolloutsChanged = original.Variations.Any(v1 =>
            {
                var isRolloutChanged = false;
                foreach (var v2 in current.Variations)
                {
                    // check if rollout is different
                    if (Math.Abs(v1.Rollout[0] - v2.Rollout[0]) > tolerance ||
                        Math.Abs(v1.Rollout[1] - v2.Rollout[1]) > tolerance) 
                    {
                        isRolloutChanged = true;
                        break;
                    }
                }

                return isRolloutChanged;
            });
        }

        if (isRolloutsChanged)
        {
            var variations = new RuleVariations { RuleId = ruleId, RolloutVariations = current.Variations };
            instructions.Add(new UpdateVariationOrRolloutInstruction(variations));
        }

        return instructions;
    }

    // TODO: need review
    public static IEnumerable<FlagInstruction> CompareCondition(string ruleId, Condition original, Condition current)
    {
        if (original.Equals(current))
        {
            return new[] { NoopFlagInstruction.Instance };
        }

        var instructions = new List<FlagInstruction>();

        var multiValueOps = new[] { OperatorTypes.IsOneOf, OperatorTypes.NotOneOf };
        if (original.Property == current.Property)
        {
            // if is segment condition
            if (SegmentConsts.ConditionProperties.Contains(original.Property) &&
                original.Value != current.Value)
            {
                CompareConditionValues();
            }

            // if is multi values condition
            else if (original.Op == current.Op &&
                     multiValueOps.Contains(original.Op) &&
                     original.Value != current.Value)
            {
                CompareConditionValues();
            }
        }
        else
        {
            var condition = new RuleCondition { RuleId = ruleId, Condition = current };
            instructions.Add(new UpdateConditionInstruction(condition));
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

                var instruction = new RemoveValuesFromConditionInstruction(conditionValues);
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

                var instruction = new AddValuesToConditionInstruction(conditionValues);
                instructions.Add(instruction);
            }
        }
    }
}