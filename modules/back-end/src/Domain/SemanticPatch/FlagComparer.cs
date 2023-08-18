using System.Text.Json;
using Domain.FeatureFlags;
using Domain.Segments;
using Domain.Targeting;

namespace Domain.SemanticPatch;

public class FlagComparer
{
    private readonly FeatureFlag _original;
    private readonly FeatureFlag _current;

    public FlagComparer(FeatureFlag original, FeatureFlag current)
    {
        _original = original;
        _current = current;
    }

    public IEnumerable<FlagInstruction> Compare(FeatureFlag original, FeatureFlag current)
    {
        var instructions = new List<FlagInstruction>();

        instructions.Add(CompareStatus());
        instructions.Add(CompareArchived());

        instructions.Add(CompareName());
        instructions.Add(CompareDescription());
        instructions.AddRange(CompareTags());

        instructions.Add(CompareVariationType());
        instructions.AddRange(CompareVariations());

        instructions.Add(CompareDisabledVariation());

        instructions.AddRange(CompareDefaultVariation());
        instructions.AddRange(CompareTargetUsers());
        instructions.AddRange(CompareRules(original.Rules, current.Rules));

        // exclude noop instructions
        instructions.RemoveAll(x => x.Kind == FlagInstructionKind.Noop);

        return instructions;
    }

    public FlagInstruction CompareStatus()
    {
        if (_original.IsEnabled == _current.IsEnabled)
        {
            return NoopFlagInstruction.Instance;
        }

        var kind = _current.IsEnabled ? FlagInstructionKind.TurnFlagOn : FlagInstructionKind.TurnFlagOff;
        var instruction = new StatusInstruction(kind);
        return instruction;
    }

    public FlagInstruction CompareArchived()
    {
        if (_original.IsArchived == _current.IsArchived)
        {
            return NoopFlagInstruction.Instance;
        }

        var kind = _current.IsArchived ? FlagInstructionKind.ArchiveFlag : FlagInstructionKind.RestoreFlag;
        var instruction = new ArchiveInstruction(kind);
        return instruction;
    }

    public FlagInstruction CompareName()
    {
        if (_original.Name == _current.Name)
        {
            return NoopFlagInstruction.Instance;
        }

        var instruction = new NameInstruction(_current.Name);
        return instruction;
    }

    public FlagInstruction CompareDescription()
    {
        if (_original.Description == _current.Description)
        {
            return NoopFlagInstruction.Instance;
        }

        var instruction = new DescriptionInstruction(_current.Description);
        return instruction;
    }

    public IEnumerable<FlagInstruction> CompareTags()
    {
        var removedTags = _original.Tags.Except(_current.Tags).ToArray();
        var addedTags = _current.Tags.Except(_original.Tags).ToArray();

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

    public FlagInstruction CompareVariationType()
    {
        if (_original.VariationType == _current.VariationType)
        {
            return NoopFlagInstruction.Instance;
        }

        var instruction = new VariationTypeInstruction(_current.VariationType);
        return instruction;
    }

    public IEnumerable<FlagInstruction> CompareVariations()
    {
        var removedVariations = _original.Variations.ExceptBy(_current.Variations.Select(v => v.Id), v => v.Id);
        var addedVariations = _current.Variations.ExceptBy(_original.Variations.Select(v => v.Id), v => v.Id);
        var commonVariations = _original.Variations.IntersectBy(_current.Variations.Select(v => v.Id), v => v.Id);

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
            var oldVariation = _original.Variations.First(v => v.Id == variation.Id);
            var newVariation = _current.Variations.First(v => v.Id == variation.Id);

            if (!oldVariation.Equals(newVariation))
            {
                instructions.Add(new UpdateVariationInstruction(newVariation));
            }
        }

        return instructions;
    }

    public FlagInstruction CompareDisabledVariation()
    {
        if (_original.DisabledVariationId == _current.DisabledVariationId)
        {
            return NoopFlagInstruction.Instance;
        }

        var instruction = new DisabledVariationInstruction(_current.DisabledVariationId);
        return instruction;
    }

    // TODO: refactor this method
    public IEnumerable<FlagInstruction> CompareDefaultVariation()
    {
        var instructions = new List<FlagInstruction>();

        var originalFallthrough = _original.Fallthrough;
        var currentFallthrough = _current.Fallthrough;

        var isFallThroughChanged = originalFallthrough.DispatchKey != currentFallthrough.DispatchKey;
        if (!isFallThroughChanged && originalFallthrough.Variations.Count != currentFallthrough.Variations.Count)
        {
            isFallThroughChanged = true;
        }

        if (!isFallThroughChanged)
        {
            var removedVariations =
                originalFallthrough.Variations.ExceptBy(currentFallthrough.Variations.Select(v => v.Id), v => v.Id);
            var addedVariations =
                currentFallthrough.Variations.ExceptBy(originalFallthrough.Variations.Select(v => v.Id), v => v.Id);

            if (removedVariations.Any() || addedVariations.Any())
            {
                isFallThroughChanged = true;
            }
            else
            {
                const double tolerance = 0.001;
                isFallThroughChanged = originalFallthrough.Variations.Any(v1 =>
                {
                    var isRolloutChanged = false;
                    foreach (var v2 in currentFallthrough.Variations)
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
            instructions.Add(new DefaultVariationInstruction(currentFallthrough));
        }

        return instructions;
    }

    public IEnumerable<FlagInstruction> CompareTargetUsers()
    {
        var instructions = new List<FlagInstruction>();

        var originalTargetUsers = _original.TargetUsers;
        var currentTargetUsers = _current.TargetUsers;

        foreach (var variation in _current.Variations)
        {
            var original = originalTargetUsers.FirstOrDefault(x => x.VariationId == variation.Id);
            var current = currentTargetUsers.FirstOrDefault(x => x.VariationId == variation.Id);

            var differs = CompareTargetUser(variation.Id, original, current);
            instructions.AddRange(differs);
        }

        return instructions;

        IEnumerable<FlagInstruction> CompareTargetUser(string variationId, TargetUser original, TargetUser current)
        {
            if (original == null && current != null)
            {
                var targetUser = new TargetUser { VariationId = variationId, KeyIds = current.KeyIds };
                var instruction = new TargetUsersInstruction(FlagInstructionKind.SetTargetUsers, targetUser);

                return new FlagInstruction[] { instruction };
            }

            if (original != null && current == null)
            {
                var targetUser = new TargetUser { VariationId = variationId, KeyIds = Array.Empty<string>() };
                var instruction = new TargetUsersInstruction(FlagInstructionKind.SetTargetUsers, targetUser);

                return new FlagInstruction[] { instruction };
            }

            if (original != null && current != null)
            {
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

            return new FlagInstruction[] { NoopFlagInstruction.Instance };
        }
    }

    public IEnumerable<FlagInstruction> CompareRules(ICollection<TargetRule> original, ICollection<TargetRule> current)
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

    public IEnumerable<FlagInstruction> CompareRule(TargetRule original, TargetRule current)
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
    public IEnumerable<FlagInstruction> CompareCondition(string ruleId, Condition original, Condition current)
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