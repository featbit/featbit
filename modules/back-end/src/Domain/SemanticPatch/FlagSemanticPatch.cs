using System.Text.Json;
using Domain.FeatureFlags;
using Domain.Targeting;

namespace Domain.SemanticPatch;

public class FlagSemanticPatch
{
    private delegate Instruction InstructionCreator(string kind, JsonElement value);
    
    private static readonly Dictionary<string, InstructionCreator> InstructionCreators = new()
    {
        { FlagInstructionKind.TurnFlagOn, (kind, _) => new StatusInstruction(kind) },
        { FlagInstructionKind.TurnFlagOff, (kind, _) => new StatusInstruction(kind) },
        { FlagInstructionKind.ArchiveFlag, (kind, _) => new ArchiveInstruction(kind) },
        { FlagInstructionKind.RestoreFlag, (kind, _) => new ArchiveInstruction(kind) },
        { FlagInstructionKind.UpdateName, (_, value) => new NameInstruction(value.GetString()) },
        { FlagInstructionKind.UpdateDescription, (_, value) => new DescriptionInstruction(value.GetString()) },
        { FlagInstructionKind.AddTags, (kind, value) => new TagsInstruction(kind, value.Deserialize<ICollection<string>>()) },
        { FlagInstructionKind.RemoveTags, (kind, value) => new TagsInstruction(kind, value.Deserialize<ICollection<string>>()) },
        { FlagInstructionKind.UpdateVariationType, (_, value) => new VariationTypeInstruction(value.GetString()) },
        { FlagInstructionKind.AddVariation, (_, value) => new AddVariationInstruction(value.Deserialize<Variation>(ReusableJsonSerializerOptions.Web)) },
        { FlagInstructionKind.RemoveVariation, (_, value) => new RemoveVariationInstruction(value.GetString()) },
        { FlagInstructionKind.UpdateVariation, (_, value) => new UpdateVariationInstruction(value.Deserialize<Variation>(ReusableJsonSerializerOptions.Web)) },
        { FlagInstructionKind.UpdateDisabledVariation, (_, value) => new DisabledVariationInstruction(value.GetString()) },
        { FlagInstructionKind.UpdateDefaultVariation, (_, value) => new DefaultVariationInstruction(value.Deserialize<Fallthrough>(ReusableJsonSerializerOptions.Web)) },
        { FlagInstructionKind.SetTargetUsers, (kind, value) => new TargetUsersInstruction(kind, value.Deserialize<TargetUser>(ReusableJsonSerializerOptions.Web)) },
        { FlagInstructionKind.AddTargetUsers, (kind, value) => new TargetUsersInstruction(kind, value.Deserialize<TargetUser>(ReusableJsonSerializerOptions.Web)) },
        { FlagInstructionKind.RemoveTargetUsers, (kind, value) => new TargetUsersInstruction(kind, value.Deserialize<TargetUser>(ReusableJsonSerializerOptions.Web)) },
        { FlagInstructionKind.SetRules, (_, value) => new SetRulesInstruction(value.Deserialize<ICollection<TargetRule>>(ReusableJsonSerializerOptions.Web)) },
        { FlagInstructionKind.AddRule, (_, value) => new AddRuleInstruction( value.Deserialize<TargetRule>(ReusableJsonSerializerOptions.Web)) },
        { FlagInstructionKind.RemoveRule, (_, value) => new RemoveRuleInstruction(value.GetString()) },
        { FlagInstructionKind.UpdateRuleName, (_, value) => new RuleNameInstruction(value.Deserialize<RuleName>(ReusableJsonSerializerOptions.Web)) },
        { FlagInstructionKind.UpdateRuleDispatchKey, (_, value) => new RuleDispatchKeyInstruction(value.Deserialize<RuleDispatchKey>(ReusableJsonSerializerOptions.Web)) },
        { FlagInstructionKind.RemoveRuleConditions, (_, value) => new RemoveConditionsInstruction(value.Deserialize<RuleConditionIds>(ReusableJsonSerializerOptions.Web)) },
        { FlagInstructionKind.AddRuleConditions, (_, value) => new AddConditionsInstruction(value.Deserialize<RuleConditions>(ReusableJsonSerializerOptions.Web)) },
        { FlagInstructionKind.UpdateRuleCondition, (_, value) => new UpdateConditionInstruction(value.Deserialize<RuleCondition>(ReusableJsonSerializerOptions.Web)) },
        { FlagInstructionKind.RemoveValuesFromRuleCondition, (_, value) => new RemoveValuesFromConditionInstruction(value.Deserialize<RuleConditionValues>(ReusableJsonSerializerOptions.Web)) },
        { FlagInstructionKind.AddValuesToRuleCondition, (_, value) => new AddValuesToConditionInstruction(value.Deserialize<RuleConditionValues>(ReusableJsonSerializerOptions.Web)) },
        { FlagInstructionKind.UpdateRuleVariationOrRollouts, (_, value) => new UpdateVariationOrRolloutInstruction(value.Deserialize<RuleVariations>(ReusableJsonSerializerOptions.Web)) },
    };
    
    public static IEnumerable<Instruction> GetInstructionsFromJsonElement(JsonElement json)
    {
        if (json.ValueKind != JsonValueKind.Array)
        {
            return Array.Empty<Instruction>();
        }
        
        var instructions = new List<Instruction>();
        foreach (var jsonElement in json.EnumerateArray())
        {
            if (!jsonElement.TryGetProperty("kind", out var kindElement))
            {
                continue;
            }
            
            var kind = kindElement.GetString()!;
            if (!InstructionCreators.TryGetValue(kind, out var creator))
            {
                continue;
            }

            JsonElement value = default;
            if (jsonElement.TryGetProperty("value", out var valueElement))
            {
                value = valueElement;
            }
            
            var patch = creator.Invoke(kind, value);
            instructions.Add(patch);
        }

        return instructions;
    }

    public static ICollection<FlagInstruction> GetInstructions(FeatureFlag flag1, FeatureFlag flag2)
    {
        var instructions = new List<FlagInstruction>();
        
        // Turn on or off the flag
        AddStatusInstruction(instructions, flag1, flag2);
        
        // Archive or restore the flag (life cycle)
        AddArchiveInstruction(instructions, flag1, flag2);
        
        // Update settings
        AddNameInstruction(instructions, flag1, flag2);
        AddDescriptionInstruction(instructions, flag1, flag2);
        AddTagsInstruction(instructions, flag1, flag2);
        
        // Update variations
        AddVariationTypeInstruction(instructions, flag1, flag2);
        AddVariationInstructions(instructions, flag1, flag2);
        
        /****************** Update targeting ******************/
        // Update variation when flag is off
        AddDisabledVariationInstruction(instructions, flag1, flag2);
        
        // Update default variation when flag is on
        AddDefaultVariationInstruction(instructions, flag1, flag2);
        
        // Update targeting users
        AddTargetUsersInstruction(instructions, flag1, flag2);
        
        // Targeting rules
        AddTargetRulesInstruction(instructions, flag1, flag2);
        
        return instructions;
    }

    #region targeting
    
    private static void AddDisabledVariationInstruction(ICollection<FlagInstruction> instructions, FeatureFlag flag1, FeatureFlag flag2)
    {
        if (flag1.DisabledVariationId != flag2.DisabledVariationId)
        {
            instructions.Add(new DisabledVariationInstruction(flag2.DisabledVariationId));
        }
    }
    
    private static void AddDefaultVariationInstruction(ICollection<FlagInstruction> instructions, FeatureFlag flag1, FeatureFlag flag2)
    {
        bool isFallThroughChanged = flag1.Fallthrough.DispatchKey != flag2.Fallthrough.DispatchKey;
    
        if (!isFallThroughChanged && flag1.Fallthrough.Variations.Count != flag2.Fallthrough.Variations.Count)
        {
            isFallThroughChanged = true;
        }
        
        if (!isFallThroughChanged)
        {
            var removedVariations = flag1.Fallthrough.Variations.ExceptBy(flag2.Fallthrough.Variations.Select( v => v.Id), v => v.Id);
            var addedVariations = flag2.Fallthrough.Variations.ExceptBy(flag1.Fallthrough.Variations.Select( v => v.Id), v => v.Id);
            
            if (removedVariations.Any() || addedVariations.Any())
            {
                isFallThroughChanged = true;
            }
            else
            {
                const double tolerance = 0.001;
                isFallThroughChanged = flag1.Fallthrough.Variations.Any(v1 =>
                {
                    var isRolloutChanged = false;
                    foreach (var v2 in flag2.Fallthrough.Variations)
                    {
                        if (Math.Abs(v1.Rollout[0] - v2.Rollout[0]) > tolerance || Math.Abs(v1.Rollout[1] - v2.Rollout[1]) > tolerance) // rollout is different
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
            instructions.Add(new DefaultVariationInstruction(flag2.Fallthrough));
        }
    }
    
    private static void AddTargetUsersInstruction(ICollection<FlagInstruction> instructions, FeatureFlag flag1, FeatureFlag flag2)
    {
        foreach (var variation in flag2.Variations)
        {
            var flag1TargetUsers = flag1.TargetUsers.FirstOrDefault(x => x.VariationId == variation.Id);
            var flag2TargetUsers = flag2.TargetUsers.FirstOrDefault(x => x.VariationId == variation.Id);
    
            if (flag1TargetUsers == null && flag2TargetUsers != null)
            {
                instructions.Add(new TargetUsersInstruction(FlagInstructionKind.SetTargetUsers,new TargetUser { VariationId = variation.Id, KeyIds = flag2TargetUsers.KeyIds }));
            }
            else if (flag1TargetUsers != null && flag2TargetUsers == null)
            {
                instructions.Add(new TargetUsersInstruction(FlagInstructionKind.SetTargetUsers,new TargetUser { VariationId = variation.Id, KeyIds = Array.Empty<string>() }));
            }
            else if (flag1TargetUsers != null && flag2TargetUsers != null)
            {
                var addedUserKeyIds = flag2TargetUsers.KeyIds.Except(flag1TargetUsers.KeyIds ?? new List<string>()).ToList();
                var removedUserKeyIds = flag1TargetUsers.KeyIds.Except(flag2TargetUsers.KeyIds ?? new List<string>()).ToList();
    
                if (addedUserKeyIds.Any())
                {
                    instructions.Add(new TargetUsersInstruction(FlagInstructionKind.AddTargetUsers,new TargetUser { VariationId = variation.Id, KeyIds = addedUserKeyIds }));
                }
    
                if (removedUserKeyIds.Any())
                {
                    instructions.Add(new TargetUsersInstruction(FlagInstructionKind.RemoveTargetUsers,new TargetUser { VariationId = variation.Id, KeyIds = removedUserKeyIds }));
                }
            }
        }
    }
    
    private static void AddTargetRulesInstruction(ICollection<FlagInstruction> instructions, FeatureFlag flag1, FeatureFlag flag2)
    {
        void UpdateRuleConditionValue(ICollection<FlagInstruction> instructions, Condition condition1, Condition condition2, TargetRule rule2)
        {
            var values1 = JsonSerializer.Deserialize<List<string>>(condition1.Value);
            var values2 = JsonSerializer.Deserialize<List<string>>(condition2.Value);
    
            var removedValues = values1.Except(values2).ToList();
            var addedValues = values2.Except(values1).ToList();
    
            if (removedValues.Any())
            {
                instructions.Add(
                    new RemoveValuesFromConditionInstruction(new RuleConditionValues { RuleId = rule2.Id, ConditionId = condition2.Id, Values = removedValues }));
            }
    
            if (addedValues.Any())
            {
                instructions.Add(new AddValuesToConditionInstruction(new RuleConditionValues { RuleId = rule2.Id, ConditionId = condition2.Id, Values = addedValues}));
            }
        }
    
        if (!flag1.Rules.Any() && !flag2.Rules.Any())
        {
            return;
        }
    
        if ((!flag1.Rules.Any() && flag2.Rules.Any()) || (flag1.Rules.Any() && !flag2.Rules.Any()))
        {
            instructions.Add(new SetRulesInstruction(flag2.Rules));
            return;
        }
        
        var addedRules = flag2.Rules.ExceptBy(flag1.Rules.Select( v => v.Id), v => v.Id).ToList();
        var removedRules = flag1.Rules.ExceptBy(flag2.Rules.Select( v => v.Id), v => v.Id).ToList();
        var commonRules = flag1.Rules.IntersectBy(flag2.Rules.Select( v => v.Id), v => v.Id);
        
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
            var rule1 = flag1.Rules.FirstOrDefault(x => x.Id == rule.Id);
            var rule2 = flag2.Rules.FirstOrDefault(x => x.Id == rule.Id);
    
            if (!string.Equals(rule1!.Name, rule2!.Name))
            {
                instructions.Add(new RuleNameInstruction(new RuleName { RuleId = rule2.Id, Name = rule2.Name }));
            }
            
            if (!string.Equals(rule1!.DispatchKey, rule2!.DispatchKey))
            {
                instructions.Add(new RuleDispatchKeyInstruction(new RuleDispatchKey { RuleId = rule2.Id, DispatchKey = rule2.DispatchKey }));
            }
            
            // rule conditions
            var addedConditions = rule2.Conditions.ExceptBy(rule1.Conditions.Select( v => v.Id), v => v.Id).ToList();
            var removedConditions = rule1.Conditions.ExceptBy(rule2.Conditions.Select( v => v.Id), v => v.Id).Select(x => x.Id).ToList();
            
            if (removedConditions.Any())
            {
                instructions.Add(new RemoveConditionsInstruction(new RuleConditionIds { RuleId = rule2.Id, ConditionIds = removedConditions }));
            }
            
            if (addedConditions.Any())
            {
                instructions.Add(new AddConditionsInstruction(new RuleConditions { RuleId = rule2.Id, Conditions = addedConditions }));
            }
            
            var commonConditions = rule1.Conditions.IntersectBy(rule2.Conditions.Select( v => v.Id), v => v.Id);
    
            var multiTypeOps = new List<string> { "IsOneOf", "NotOneOf" };
            foreach (var condition in commonConditions)
            {
                var condition1 = rule1.Conditions.First(v => v.Id == condition.Id);
                var condition2 = rule2.Conditions.First(v => v.Id == condition.Id);
    
                if (condition1.Property.Equals("User is in segment") && condition2.Property.Equals("User is in segment"))
                {
                    if (!condition1.Value.Equals(condition2.Value))
                    {
                        UpdateRuleConditionValue(instructions, condition1, condition2, rule2);
                    }
                } else if (condition1.Property.Equals(condition2.Property) && condition1.Op.Equals(condition2.Op) && multiTypeOps.Any(x => x.Equals(condition2.Op)) && !condition1.Value.Equals(condition2.Value))
                {
                    UpdateRuleConditionValue(instructions, condition1, condition2, rule2);
                } else if (!condition1.Property.Equals(condition2.Property) || !condition1.Op.Equals(condition2.Op) || !condition1.Value.Equals(condition2.Value))
                {
                    instructions.Add(new UpdateConditionInstruction(new RuleCondition { RuleId = rule2.Id, Condition = condition2 }));
                }
            }
            
            // rule rollout
            var removedRollouts = rule1.Variations.ExceptBy(rule2.Variations.Select( v => v.Id), v => v.Id);
            var addedRollouts = rule2.Variations.ExceptBy(rule1.Variations.Select( v => v.Id), v => v.Id);
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
                        if (Math.Abs(v1.Rollout[0] - v2.Rollout[0]) > tolerance || Math.Abs(v1.Rollout[1] - v2.Rollout[1]) > tolerance) // rollout is different
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
                instructions.Add(new UpdateVariationOrRolloutInstruction(new RuleVariations { RuleId = rule2.Id, RolloutVariations = rule2.Variations }));
            }
        }
    }
    
    #endregion

    private static void AddStatusInstruction(ICollection<FlagInstruction> instructions, FeatureFlag flag1, FeatureFlag flag2)
    {
        if (flag1.IsEnabled != flag2.IsEnabled)
        {
            instructions.Add(new StatusInstruction(flag2.IsEnabled? FlagInstructionKind.TurnFlagOn : FlagInstructionKind.TurnFlagOff));
        }
    }
 
    private static void AddArchiveInstruction(ICollection<FlagInstruction> instructions, FeatureFlag flag1, FeatureFlag flag2)
    {
        if (flag1.IsArchived != flag2.IsArchived)
        {
            instructions.Add(new ArchiveInstruction(flag2.IsArchived ? FlagInstructionKind.ArchiveFlag : FlagInstructionKind.RestoreFlag));
        }
    }
    
    private static void AddNameInstruction(ICollection<FlagInstruction> instructions, FeatureFlag flag1, FeatureFlag flag2)
    {
        if (!String.Equals(flag1.Name, flag2.Name))
        {
            instructions.Add(new NameInstruction(flag2.Name));
        }
    }
    
    private static void AddDescriptionInstruction(ICollection<FlagInstruction> instructions, FeatureFlag flag1, FeatureFlag flag2)
    {
        if (!String.Equals(flag1.Description, flag2.Description))
        {
            instructions.Add(new DescriptionInstruction(flag2.Description));
        }
    }
    
    private static void AddTagsInstruction(ICollection<FlagInstruction> instructions, FeatureFlag flag1, FeatureFlag flag2)
    {
        var removedTags = flag1.Tags.Except(flag2.Tags).ToList();
        var addedTags = flag2.Tags.Except(flag1.Tags).ToList();
    
        if (removedTags.Any())
        {
            instructions.Add(new TagsInstruction(FlagInstructionKind.RemoveTags, removedTags));
        }
        
        if (addedTags.Any())
        {
            instructions.Add(new TagsInstruction(FlagInstructionKind.AddTags, addedTags));
        }
    }
    
    private static void AddVariationTypeInstruction(ICollection<FlagInstruction> instructions, FeatureFlag flag1, FeatureFlag flag2)
    {
        if (flag1.VariationType != flag2.VariationType)
        {
            instructions.Add(new VariationTypeInstruction(flag2.VariationType));
        }
    }
    
    private static void AddVariationInstructions(List<FlagInstruction> instructions, FeatureFlag flag1, FeatureFlag flag2)
    {
        var removedVariations = flag1.Variations.ExceptBy(flag2.Variations.Select( v => v.Id), v => v.Id);
        var addedVariations = flag2.Variations.ExceptBy(flag1.Variations.Select( v => v.Id), v => v.Id);
        var commonVariations = flag1.Variations.IntersectBy(flag2.Variations.Select( v => v.Id), v => v.Id);
    
        instructions.AddRange(removedVariations.Select(v => new RemoveVariationInstruction(v.Id)));
        instructions.AddRange(addedVariations.Select(v =>
        {
            v.Id = Guid.NewGuid().ToString();
            return new AddVariationInstruction(v);
        }));
        
        foreach (var variation in commonVariations)
        {
            var variation1 = flag1.Variations.First(v => v.Id == variation.Id);
            var variation2 = flag2.Variations.First(v => v.Id == variation.Id);
            
            if (!variation1.Name.Equals(variation2.Name) || !variation.Value.Equals(variation2.Value))
            {
                instructions.Add(new UpdateVariationInstruction(variation2));
            }
        }
    }
}