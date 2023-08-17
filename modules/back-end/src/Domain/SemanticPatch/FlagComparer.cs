using System.Text.Json;
using Domain.FeatureFlags;
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

    public IEnumerable<FlagInstruction> Compare()
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
        instructions.AddRange(CompareRules());

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

    public IEnumerable<FlagInstruction> CompareRules()
    {
        if (!_original.Rules.Any() && !_current.Rules.Any())
        {
            return new[] { NoopFlagInstruction.Instance };
        }

        if ((!_original.Rules.Any() && _current.Rules.Any()) || (_original.Rules.Any() && !_current.Rules.Any()))
        {
            var instruction = new SetRulesInstruction(_current.Rules);
            return new FlagInstruction[] { instruction };
        }

        var instructions = new List<FlagInstruction>();

        var addedRules = _current.Rules.ExceptBy(_original.Rules.Select(v => v.Id), v => v.Id).ToArray();
        var removedRules = _original.Rules.ExceptBy(_current.Rules.Select(v => v.Id), v => v.Id).ToArray();
        var commonRules = _original.Rules.IntersectBy(_current.Rules.Select(v => v.Id), v => v.Id);

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
            // TODO: refactor this
            var rule1 = _original.Rules.First(x => x.Id == rule.Id);
            var rule2 = _current.Rules.First(x => x.Id == rule.Id);

            if (rule1.Name != rule2.Name)
            {
                var value = new RuleName { RuleId = rule2.Id, Name = rule2.Name };
                instructions.Add(new RuleNameInstruction(value));
            }

            if (rule1.DispatchKey != rule2.DispatchKey)
            {
                var value = new RuleDispatchKey { RuleId = rule2.Id, DispatchKey = rule2.DispatchKey };
                instructions.Add(new RuleDispatchKeyInstruction(value));
            }

            // rule conditions
            var addedConditions = rule2.Conditions.ExceptBy(rule1.Conditions.Select(v => v.Id), v => v.Id).ToList();
            var removedConditions = rule1.Conditions.ExceptBy(rule2.Conditions.Select(v => v.Id), v => v.Id)
                .Select(x => x.Id).ToList();

            if (removedConditions.Any())
            {
                instructions.Add(new RemoveConditionsInstruction(new RuleConditionIds
                    { RuleId = rule2.Id, ConditionIds = removedConditions }));
            }

            if (addedConditions.Any())
            {
                instructions.Add(new AddConditionsInstruction(new RuleConditions
                    { RuleId = rule2.Id, Conditions = addedConditions }));
            }

            var commonConditions = rule1.Conditions.IntersectBy(rule2.Conditions.Select(v => v.Id), v => v.Id);

            var multiTypeOps = new List<string> { "IsOneOf", "NotOneOf" };
            foreach (var condition in commonConditions)
            {
                var condition1 = rule1.Conditions.First(v => v.Id == condition.Id);
                var condition2 = rule2.Conditions.First(v => v.Id == condition.Id);

                if (condition1.Property.Equals("User is in segment") &&
                    condition2.Property.Equals("User is in segment"))
                {
                    if (!condition1.Value.Equals(condition2.Value))
                    {
                        CompareConditionValues(rule2.Id, condition1, condition2);
                    }
                }
                else if (condition1.Property.Equals(condition2.Property) && condition1.Op.Equals(condition2.Op) &&
                         multiTypeOps.Any(x => x.Equals(condition2.Op)) && !condition1.Value.Equals(condition2.Value))
                {
                    CompareConditionValues(rule2.Id, condition1, condition2);
                }
                else if (!condition1.Property.Equals(condition2.Property) || !condition1.Op.Equals(condition2.Op) ||
                         !condition1.Value.Equals(condition2.Value))
                {
                    instructions.Add(new UpdateConditionInstruction(new RuleCondition
                        { RuleId = rule2.Id, Condition = condition2 }));
                }
            }

            // rule rollout
            var removedRollouts = rule1.Variations.ExceptBy(rule2.Variations.Select(v => v.Id), v => v.Id);
            var addedRollouts = rule2.Variations.ExceptBy(rule1.Variations.Select(v => v.Id), v => v.Id);
            bool isRolloutsChanged;

            if (removedRollouts.Any() || addedRollouts.Any())
            {
                isRolloutsChanged = true;
            }
            else
            {
                const double tolerance = 0.001;
                isRolloutsChanged = rule1.Variations.Any(v1 =>
                {
                    var isRolloutChanged = false;
                    foreach (var v2 in rule2.Variations)
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

            if (isRolloutsChanged)
            {
                instructions.Add(new UpdateVariationOrRolloutInstruction(new RuleVariations
                    { RuleId = rule2.Id, RolloutVariations = rule2.Variations }));
            }
        }

        return instructions;

        void CompareConditionValues(string ruleId, Condition originalCondition, Condition currentCondition)
        {
            var original = JsonSerializer.Deserialize<List<string>>(originalCondition.Value);
            var current = JsonSerializer.Deserialize<List<string>>(currentCondition.Value);

            var removedValues = original.Except(current).ToList();
            var addedValues = current.Except(original).ToList();

            if (removedValues.Any())
            {
                var conditionValues = new RuleConditionValues
                {
                    RuleId = ruleId,
                    ConditionId = currentCondition.Id,
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
                    ConditionId = currentCondition.Id,
                    Values = addedValues
                };

                var instruction = new AddValuesToConditionInstruction(conditionValues);
                instructions.Add(instruction);
            }
        }
    }
}