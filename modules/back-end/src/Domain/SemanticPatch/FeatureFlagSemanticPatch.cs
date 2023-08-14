using System.Text.Json;
using System.Xml.Schema;
using Domain.FeatureFlags;
using Domain.Targeting;

namespace Domain.SemanticPatch;

public class FeatureFlagSemanticPatch
{
    public ICollection<SemanticPatchInstruction> GetInstructions(FeatureFlag flag1, FeatureFlag flag2)
    {
        var instructions = new List<SemanticPatchInstruction>();
        
        // Turn on or off the flag
        AddIsEnabledInstruction(ref instructions, flag1, flag2);
        
        // Archive or restore the flag (life cycle)
        AddIsArchivedfInstruction(ref instructions, flag1, flag2);
        
        // Update settings
        AddNameInstruction(ref instructions, flag1, flag2);
        AddDescriptionInstruction(ref instructions, flag1, flag2);
        AddTagsInstruction(ref instructions, flag1, flag2);

        // Update variations
        AddVariationTypeInstruction(ref instructions, flag1, flag2);
        AddVariationInstructions(ref instructions, flag1, flag2);
        
        /****************** Update targeting ******************/
        // Update variation when flag is off
        AddDisabledVariationInstruction(ref instructions, flag1, flag2);
        
        // Update default variation when flag is on
        AddDefaultVariationInstruction(ref instructions, flag1, flag2);
        
        // Update targeting users
        AddTargetUsersInstruction(ref instructions, flag1, flag2);
        
        // Targeting rules
        AddTargetRulesInstruction(ref instructions, flag1, flag2);
        
        return instructions;
    }

    public FeatureFlag ApplyPatches(FeatureFlag flag, IEnumerable<SemanticPatchInstruction> instructions)
    {
        foreach (var instruction in instructions)
        {
            switch (instruction.Kind)
            {
                case FlagInstructionKind.TurnFlagOn:
                    flag.IsEnabled = true;
                    break;
                case FlagInstructionKind.TurnFlagOff:
                    flag.IsEnabled = false;
                    break;
                case FlagInstructionKind.ArchiveFlag:
                    flag.IsArchived = true;
                    break;
                case FlagInstructionKind.RestoreFlag:
                    flag.IsArchived = false;
                    break;
                case FlagInstructionKind.RemoveTags:
                    flag.Tags = flag.Tags.Except(((JsonElement)instruction.Value).Deserialize<IEnumerable<string>>()).ToList();
                    break;
                case FlagInstructionKind.AddTags:
                    flag.Tags = flag.Tags.Union(((JsonElement)instruction.Value).Deserialize<IEnumerable<string>>()).ToList();
                    break;
                case FlagInstructionKind.UpdateName:
                    flag.Name = ((JsonElement)instruction.Value).Deserialize<string>();
                    break;
                case FlagInstructionKind.UpdateDescription:
                    flag.Description = ((JsonElement)instruction.Value).Deserialize<string>();
                    break;
                case FlagInstructionKind.AddVariation:
                    var variationToAdd = ((JsonElement)instruction.Value).Deserialize<Variation>(ReusableJsonSerializerOptions.Web);
                    flag.Variations.Add(variationToAdd);
                    break;
                case FlagInstructionKind.RemoveVariation:
                    var variationId = ((JsonElement)instruction.Value).Deserialize<string>();
                    var variationToRemove = flag.Variations.FirstOrDefault(v => v.Id == variationId);
                    if (variationToRemove != null)
                    {
                        flag.Variations.Remove(variationToRemove);
                    }
                    break;
                case FlagInstructionKind.UpdateVariation:
                    var variationToUpdate = ((JsonElement)instruction.Value).Deserialize<Variation>(ReusableJsonSerializerOptions.Web);
                    var variation = flag.Variations.FirstOrDefault(v => v.Id == variationToUpdate.Id);
                    if (variation != null)
                    {
                        variation.Name = variationToUpdate.Name;
                        variation.Value = variationToUpdate.Value;
                    }
                    break;
                case FlagInstructionKind.UpdateVariationType:
                    var variationType = ((JsonElement)instruction.Value).Deserialize<string>();
                    flag.VariationType = variationType;
                    break;
                case FlagInstructionKind.UpdateDefaultVariation:
                    var fallthrough = ((JsonElement)instruction.Value).Deserialize<Fallthrough>(ReusableJsonSerializerOptions.Web);
                    flag.Fallthrough = fallthrough;
                    break;
                case FlagInstructionKind.SetTargetUsers:
                    var valueForSet = ((JsonElement)instruction.Value).Deserialize<TargetUser>(ReusableJsonSerializerOptions.Web);
                    var targetUserForSet = flag.TargetUsers.FirstOrDefault(x => x.VariationId == valueForSet.VariationId);
                    if (targetUserForSet != null)
                    {
                        targetUserForSet.KeyIds = valueForSet.KeyIds;
                    }
                    else
                    {
                        flag.TargetUsers.Add(valueForSet);
                    }
                    break;
                case FlagInstructionKind.AddTargetUsers:
                    var valueForAdd = ((JsonElement)instruction.Value).Deserialize<TargetUser>(ReusableJsonSerializerOptions.Web);
                    var targetUserForAdd = flag.TargetUsers.FirstOrDefault(x => x.VariationId == valueForAdd.VariationId);
                    if (targetUserForAdd != null)
                    {
                        targetUserForAdd.KeyIds = targetUserForAdd.KeyIds.Union(valueForAdd.KeyIds).ToList();
                    }
                    else
                    {
                        flag.TargetUsers.Add(valueForAdd);
                    }
                    break;
                case FlagInstructionKind.RemoveTargetUsers:
                    var valueForRemove = ((JsonElement)instruction.Value).Deserialize<TargetUser>(ReusableJsonSerializerOptions.Web);
                    var targetUserForRemove = flag.TargetUsers.FirstOrDefault(x => x.VariationId == valueForRemove.VariationId);
                    if (targetUserForRemove != null)
                    {
                        targetUserForRemove.KeyIds = targetUserForRemove.KeyIds.Except(valueForRemove.KeyIds).ToList();
                    }
                    break;
                case FlagInstructionKind.AddRule:
                    var ruleToAdd = ((JsonElement)instruction.Value).Deserialize<TargetRule>(ReusableJsonSerializerOptions.Web);
                    flag.Rules.Add(ruleToAdd);
                    break;
                case FlagInstructionKind.RemoveRule:
                    var ruleId = ((JsonElement)instruction.Value).Deserialize<string>();
                    var ruleToRemove = flag.Rules.FirstOrDefault(r => r.Id == ruleId);
                    if (ruleToRemove != null)
                    {
                        flag.Rules.Remove(ruleToRemove);
                    }
                    break;
                case FlagInstructionKind.SetRules:
                    var rules = ((JsonElement)instruction.Value).Deserialize<IEnumerable<TargetRule>>(ReusableJsonSerializerOptions.Web);
                    flag.Rules = rules.ToList();
                    break;
                case FlagInstructionKind.UpdateRuleName:
                    var ruleToUpdate = flag.Rules.FirstOrDefault(r => r.Id == instruction.Value.GetProperty("ruleId").ToString());
                    if (ruleToUpdate != null)
                    {
                        ruleToUpdate.Name = instruction.Value.GetProperty("name").ToString();
                    }
                    break;
                case FlagInstructionKind.UpdateRuleDispatchKey:
                    var ruleToUpdateDispatchKey = flag.Rules.FirstOrDefault(r => r.Id == instruction.Value.GetProperty("ruleId").ToString());
                    if (ruleToUpdateDispatchKey != null)
                    {
                        ruleToUpdateDispatchKey.DispatchKey = instruction.Value.GetProperty("dispatchKey").ToString();
                    }
                    break;
                case FlagInstructionKind.AddRuleConditions:
                    var ruleToAddConditions = flag.Rules.FirstOrDefault(r => r.Id == instruction.Value.GetProperty("ruleId").ToString());
                    if (ruleToAddConditions != null)
                    {
                        var conditions = JsonSerializer.Deserialize<IEnumerable<Condition>>(instruction.Value.GetProperty("conditions").ToString(), ReusableJsonSerializerOptions.Web);
                        ((List<Condition>)ruleToAddConditions.Conditions).AddRange(conditions);
                    }
                    break;
                case FlagInstructionKind.RemoveRuleConditions:
                    var ruleToRemoveConditions = flag.Rules.FirstOrDefault(r => r.Id == instruction.Value.GetProperty("ruleId").ToString());
                    if (ruleToRemoveConditions != null)
                    {
                        var conditionIds = JsonSerializer.Deserialize<IEnumerable<string>>(instruction.Value.GetProperty("conditionIds").ToString(), ReusableJsonSerializerOptions.Web);
                        ((List<Condition>)ruleToRemoveConditions.Conditions).RemoveAll(c => conditionIds.Contains(c.Id));
                    }
                    break;
                case FlagInstructionKind.UpdateRuleCondition:
                    var ruleToUpdateCondition = flag.Rules.FirstOrDefault(r => r.Id == instruction.Value.GetProperty("ruleId").ToString());
                    if (ruleToUpdateCondition != null)
                    {
                        var conditionId = instruction.Value.GetProperty("conditionId").ToString();
                        var condition = ruleToUpdateCondition.Conditions.FirstOrDefault(c => c.Id == conditionId);
                        if (condition != null)
                        {
                            condition.Property = instruction.Value.GetProperty("property").ToString();
                            condition.Op = instruction.Value.GetProperty("op").ToString();
                            condition.Value = instruction.Value.GetProperty("value").ToString();
                        }
                    }
                    break;
                case FlagInstructionKind.AddValuesToRuleCondition:
                    var ruleToAddValuesToCondition = flag.Rules.FirstOrDefault(r => r.Id == instruction.Value.GetProperty("ruleId").ToString());
                    if (ruleToAddValuesToCondition != null)
                    {
                        var conditionId = instruction.Value.GetProperty("conditionId").ToString();
                        var condition = ruleToAddValuesToCondition.Conditions.FirstOrDefault(c => c.Id == conditionId);
                        if (condition != null)
                        {
                            var originalValues = JsonSerializer.Deserialize<IEnumerable<string>>(condition.Value, ReusableJsonSerializerOptions.Web);
                            var values = JsonSerializer.Deserialize<IEnumerable<string>>(instruction.Value.GetProperty("values").ToString(), ReusableJsonSerializerOptions.Web);
                            if (((List<string>)values).Any())
                            {
                                ((List<string>)originalValues).AddRange(values);
                                condition.Value = JsonSerializer.Serialize(originalValues, ReusableJsonSerializerOptions.Web);
                            }
                        }
                    }
                    break;
                case FlagInstructionKind.RemoveValuesFromRuleCondition:
                    var ruleToRemoveValuesFromCondition = flag.Rules.FirstOrDefault(r => r.Id == instruction.Value.GetProperty("ruleId").ToString());
                    if (ruleToRemoveValuesFromCondition != null)
                    {
                        var conditionId = instruction.Value.GetProperty("conditionId").ToString();
                        var condition = ruleToRemoveValuesFromCondition.Conditions.FirstOrDefault(c => c.Id == conditionId);
                        if (condition != null)
                        {
                            var originalValues = JsonSerializer.Deserialize<IEnumerable<string>>(condition.Value, ReusableJsonSerializerOptions.Web);
                            var values = JsonSerializer.Deserialize<IEnumerable<string>>(instruction.Value.GetProperty("values").ToString(), ReusableJsonSerializerOptions.Web);
                            if (((List<string>)values).Any())
                            {
                                ((List<string>)originalValues).RemoveAll(v => values.Contains(v));
                                condition.Value = JsonSerializer.Serialize(originalValues, ReusableJsonSerializerOptions.Web);
                            }
                        }
                    }
                    break;
                case FlagInstructionKind.UpdateRuleVariationOrRollouts:
                    var ruleToUpdateVariationOrRollouts = flag.Rules.FirstOrDefault(r => r.Id == instruction.Value.GetProperty("ruleId").ToString());
                    if (ruleToUpdateVariationOrRollouts != null)
                    {
                        var variations = JsonSerializer.Deserialize<IEnumerable<RolloutVariation>>(instruction.Value.GetProperty("values").ToString(), ReusableJsonSerializerOptions.Web);
                        ((List<RolloutVariation>)ruleToUpdateVariationOrRollouts.Variations).Clear();
                        ((List<RolloutVariation>)ruleToUpdateVariationOrRollouts.Variations).AddRange(variations);
                    }
                    break;
                default:
                    throw new NotImplementedException();
            }
        }

        return flag;
    }

    #region targeting

    private void AddDisabledVariationInstruction(ref List<SemanticPatchInstruction> instructions, FeatureFlag flag1, FeatureFlag flag2)
    {
        if (flag1.DisabledVariationId != flag2.DisabledVariationId)
        {
            instructions.Add(SemanticPatchInstruction.UpdateDisabledVariation(flag2.DisabledVariationId));
        }
    }

    private void AddDefaultVariationInstruction(ref List<SemanticPatchInstruction> instructions, FeatureFlag flag1, FeatureFlag flag2)
    {
        bool isFallThroughChanged = flag1.Fallthrough.DispatchKey != flag2.Fallthrough.DispatchKey;

        if (!isFallThroughChanged && flag1.Fallthrough.Variations.Count != flag2.Fallthrough.Variations.Count)
        {
            isFallThroughChanged = true;
        }
        
        if (!isFallThroughChanged)
        {
            var removedVariations = flag1.Fallthrough.Variations.Except(flag2.Fallthrough.Variations, new RolloutVariationComparer());
            var addedVariations = flag2.Fallthrough.Variations.Except(flag1.Fallthrough.Variations, new RolloutVariationComparer());
            
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
            instructions.Add(SemanticPatchInstruction.UpdateDefaultVariation(flag2.Fallthrough));
        }
    }

    private void AddTargetUsersInstruction(ref List<SemanticPatchInstruction> instructions, FeatureFlag flag1, FeatureFlag flag2)
    {
        foreach (var variation in flag2.Variations)
        {
            var flag1TargetUsers = flag1.TargetUsers.FirstOrDefault(x => x.VariationId == variation.Id);
            var flag2TargetUsers = flag2.TargetUsers.FirstOrDefault(x => x.VariationId == variation.Id);

            if (flag1TargetUsers == null && flag2TargetUsers != null)
            {
                instructions.Add(SemanticPatchInstruction.SetTargetUsers(new TargetUser { VariationId = variation.Id, KeyIds = flag2TargetUsers.KeyIds }));
            }
            else if (flag1TargetUsers != null && flag2TargetUsers == null)
            {
                instructions.Add(SemanticPatchInstruction.SetTargetUsers(new TargetUser { VariationId = variation.Id, KeyIds = new List<string>() }));
            }
            else if (flag1TargetUsers != null)
            {
                var addedUserKeyIds = flag2TargetUsers?.KeyIds.Except(flag1TargetUsers?.KeyIds ?? new List<string>()).ToList();
                var removedUserKeyIds = flag1TargetUsers?.KeyIds.Except(flag2TargetUsers?.KeyIds ?? new List<string>()).ToList();;

                if (addedUserKeyIds.Any())
                {
                    instructions.Add(SemanticPatchInstruction.AddTargetUsers(new TargetUser { VariationId = variation.Id, KeyIds = addedUserKeyIds }));
                }

                if (removedUserKeyIds.Any())
                {
                    instructions.Add(SemanticPatchInstruction.RemoveTargetUsers(new TargetUser { VariationId = variation.Id, KeyIds = removedUserKeyIds }));
                }
            }
        }
    }
    
    private void AddTargetRulesInstruction(ref List<SemanticPatchInstruction> instructions, FeatureFlag flag1, FeatureFlag flag2)
    {
        if (!flag1.Rules.Any() && !flag2.Rules.Any())
        {
            return;
        }

        if ((!flag1.Rules.Any() && flag2.Rules.Any()) || (flag1.Rules.Any() && !flag2.Rules.Any()))
        {
            instructions.Add(SemanticPatchInstruction.SetRules(flag2.Rules));
            return;
        }
        
        var addedRules = flag2.Rules.Except(flag1.Rules, new TargetRuleComparer()).ToList();
        var removedRules = flag1.Rules.Except(flag2.Rules, new TargetRuleComparer()).ToList();
        var commonRules = flag1.Rules.IntersectBy(flag2.Rules.Select( v => v.Id), v => v.Id);
        
        foreach (var rule in addedRules)
        {
            instructions.Add(SemanticPatchInstruction.AddRule(rule));
        }

        foreach (var rule in removedRules)
        {
            instructions.Add(SemanticPatchInstruction.RemoveRule(rule.Id));
        }
        
        foreach (var rule in commonRules)
        {
            var rule1 = flag1.Rules.FirstOrDefault(x => x.Id == rule.Id);
            var rule2 = flag2.Rules.FirstOrDefault(x => x.Id == rule.Id);

            if (!string.Equals(rule1!.Name, rule2!.Name))
            {
                instructions.Add(SemanticPatchInstruction.UpdateRuleName(rule2.Id, rule2.Name));
            }
            
            if (!string.Equals(rule1!.DispatchKey, rule2!.DispatchKey))
            {
                instructions.Add(SemanticPatchInstruction.UpdateRuleDispatchKey(rule2.Id, rule2.DispatchKey));
            }
            
            // rule conditions
            var addedConditions = rule2.Conditions.Except(rule1.Conditions, new RuleConditionComparer()).ToList();
            var removedConditions = rule1.Conditions.Except(rule2.Conditions, new RuleConditionComparer()).Select(x => x.Id).ToList();
            
            if (removedConditions.Any())
            {
                instructions.Add(SemanticPatchInstruction.RemoveRuleConditions(rule2.Id, removedConditions));
            }
            
            if (addedConditions.Any())
            {
                instructions.Add(SemanticPatchInstruction.AddRuleConditions(rule2.Id, addedConditions));
            }
            
            var commonConditions = rule1.Conditions.IntersectBy(rule2.Conditions.Select( v => v.Id), v => v.Id);

            var multiTypeOps = new List<string> { "IsOneOf", "NotOneOf" };
            foreach (var condition in commonConditions)
            {
                var condition1 = rule1.Conditions.First(v => v.Id == condition.Id);
                var condition2 = rule2.Conditions.First(v => v.Id == condition.Id);
                
                if (condition1.Property.Equals(condition2.Property) && condition1.Op.Equals(condition2.Op) && multiTypeOps.Any(x => x.Equals(condition2.Op)) && !condition1.Value.Equals(condition2.Value))
                {
                    var values1 = JsonSerializer.Deserialize<List<string>>(condition1.Value);
                    var values2 = JsonSerializer.Deserialize<List<string>>(condition2.Value);
                    
                    var removedValues = values1.Except(values2).ToList();
                    var addedValues = values2.Except(values1).ToList();

                    if (removedValues.Any())
                    {
                        instructions.Add(SemanticPatchInstruction.RemoveValuesFromRuleCondition(rule2.Id, condition2.Id, removedValues));
                    }
        
                    if (addedValues.Any())
                    {
                        instructions.Add(SemanticPatchInstruction.AddValuesToRuleCondition(rule2.Id, condition2.Id, addedValues));
                    }
                }
                
                if (!condition1.Property.Equals(condition2.Property) || !condition1.Op.Equals(condition2.Op) || !condition1.Value.Equals(condition2.Value))
                {
                    instructions.Add(SemanticPatchInstruction.UpdateRuleCondition(rule2.Id, condition2));
                }
            }
            
            // rule rollout
            var removedRollouts = rule1.Variations.Except(rule2.Variations, new RolloutVariationComparer());
            var addedRollouts = rule2.Variations.Except(rule1.Variations, new RolloutVariationComparer());
            var isRolloutsChanged = false;
            
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
                instructions.Add(SemanticPatchInstruction.UpdateRuleVariationOrRollouts(rule2.Id, rule2.Variations));
            }

        }
    }
    #endregion
    private void AddIsEnabledInstruction(ref List<SemanticPatchInstruction> instructions, FeatureFlag flag1, FeatureFlag flag2)
    {
        if (flag1.IsEnabled != flag2.IsEnabled)
        {
            instructions.Add(flag2.IsEnabled ? SemanticPatchInstruction.TurnFlagOn() : SemanticPatchInstruction.TurnFlagOff());
        }
    }
    
    private void AddIsArchivedfInstruction(ref List<SemanticPatchInstruction> instructions, FeatureFlag flag1, FeatureFlag flag2)
    {
        if (flag1.IsArchived != flag2.IsArchived)
        {
            instructions.Add(flag2.IsArchived ? SemanticPatchInstruction.ArchiveFlag() : SemanticPatchInstruction.RestoreFlag());
        }
    }

    private void AddNameInstruction(ref List<SemanticPatchInstruction> instructions, FeatureFlag flag1, FeatureFlag flag2)
    {
        if (!String.Equals(flag1.Name, flag2.Name))
        {
            instructions.Add(SemanticPatchInstruction.UpdateName(flag2.Name));
        }
    }
    
    private void AddDescriptionInstruction(ref List<SemanticPatchInstruction> instructions, FeatureFlag flag1, FeatureFlag flag2)
    {
        if (!String.Equals(flag1.Description, flag2.Description))
        {
            instructions.Add(SemanticPatchInstruction.UpdateDescription(flag2.Description));
        }
    }
    
    private void AddTagsInstruction(ref List<SemanticPatchInstruction> instructions, FeatureFlag flag1, FeatureFlag flag2)
    {
        var removedTags = flag1.Tags.Except(flag2.Tags).ToList();
        var addedTags = flag2.Tags.Except(flag1.Tags).ToList();

        if (removedTags.Any())
        {
            instructions.Add(SemanticPatchInstruction.RemoveTags(removedTags));
        }
        
        if (addedTags.Any())
        {
            instructions.Add(SemanticPatchInstruction.AddTags(addedTags));
        }
    }
    
    private void AddVariationTypeInstruction(ref List<SemanticPatchInstruction> instructions, FeatureFlag flag1, FeatureFlag flag2)
    {
        if (flag1.VariationType != flag2.VariationType)
        {
            instructions.Add(SemanticPatchInstruction.UpdateVariationType(flag2.VariationType));
        }
    }
    
    private void AddVariationInstructions(ref List<SemanticPatchInstruction> instructions, FeatureFlag flag1, FeatureFlag flag2)
    {
        var removedVariations = flag1.Variations.Except(flag2.Variations, new VariationComparer());
        var addedVariations = flag2.Variations.Except(flag1.Variations, new VariationComparer());
        var commonVariations = flag1.Variations.IntersectBy(flag2.Variations.Select( v => v.Id), v => v.Id);

        instructions.AddRange(removedVariations.Select(v => SemanticPatchInstruction.RemoveVariation(v.Id)));
        instructions.AddRange(addedVariations.Select(v =>
        {
            v.Id = Guid.NewGuid().ToString();
            return SemanticPatchInstruction.AddVariation(v);
        }));
        
        foreach (var variation in commonVariations)
        {
            var variation1 = flag1.Variations.First(v => v.Id == variation.Id);
            var variation2 = flag2.Variations.First(v => v.Id == variation.Id);
            
            if (!variation1.Name.Equals(variation2.Name) || !variation.Value.Equals(variation2.Value))
            {
                instructions.Add(SemanticPatchInstruction.UpdateVariation(variation2));
            }
        }
    }
}