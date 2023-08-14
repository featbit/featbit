using Domain.FeatureFlags;
using Domain.Targeting;

namespace Domain.SemanticPatch;

public class SemanticPatchInstruction
{
    public string Kind { get; set; }

    public dynamic Value { get; set; }

    public static SemanticPatchInstruction TurnFlagOn()
    {
        return new SemanticPatchInstruction { Kind = FlagInstructionKind.TurnFlagOn, Value = true };
    }
    
    public static SemanticPatchInstruction TurnFlagOff()
    {
        return new SemanticPatchInstruction { Kind = FlagInstructionKind.TurnFlagOn, Value = false };
    }
    
    public static SemanticPatchInstruction ArchiveFlag()
    {
        return new SemanticPatchInstruction { Kind = FlagInstructionKind.ArchiveFlag, Value = true };
    }
    
    public static SemanticPatchInstruction RestoreFlag()
    {
        return new SemanticPatchInstruction { Kind = FlagInstructionKind.RestoreFlag, Value = false };
    }
    
    public static SemanticPatchInstruction UpdateName(string name)
    {
        return new SemanticPatchInstruction { Kind = FlagInstructionKind.UpdateName, Value = name };
    }

    public static SemanticPatchInstruction UpdateDescription(string description)
    {
        return new SemanticPatchInstruction { Kind = FlagInstructionKind.UpdateDescription, Value = description };
    }
    
    public static SemanticPatchInstruction UpdateDisabledVariation(string variationId)
    {
        return new SemanticPatchInstruction { Kind = FlagInstructionKind.UpdateDisabledVariation, Value = variationId };
    }
    
    public static SemanticPatchInstruction UpdateDefaultVariation(Fallthrough defaultVariation)
    {
        return new SemanticPatchInstruction { Kind = FlagInstructionKind.UpdateDefaultVariation, Value = defaultVariation };
    }
    
    public static SemanticPatchInstruction RemoveTags(IEnumerable<string> tags)
    {
        return new SemanticPatchInstruction { Kind = FlagInstructionKind.RemoveTags, Value = tags };
    }
    
    public static SemanticPatchInstruction AddTags(IEnumerable<string> tags)
    {
        return new SemanticPatchInstruction { Kind = FlagInstructionKind.AddTags, Value = tags };
    }
    
    public static SemanticPatchInstruction UpdateVariationType(string variationType)
    {
        return new SemanticPatchInstruction { Kind = FlagInstructionKind.UpdateVariationType, Value = variationType };
    }
    
    public static SemanticPatchInstruction RemoveVariation(string variationId)
    {
        return new SemanticPatchInstruction { Kind = FlagInstructionKind.RemoveVariation, Value = variationId };
    }
    
    public static SemanticPatchInstruction AddVariation(Variation variation)
    {
        return new SemanticPatchInstruction { Kind = FlagInstructionKind.AddVariation, Value = variation };
    }
    
    public static SemanticPatchInstruction UpdateVariation(Variation variation)
    {
        return new SemanticPatchInstruction { Kind = FlagInstructionKind.UpdateVariation, Value = variation };
    }
    
    public static SemanticPatchInstruction AddTargetUsers(TargetUser targetUsers)
    {
        return new SemanticPatchInstruction { Kind = FlagInstructionKind.AddTargetUsers, Value = targetUsers };
    }
    
    public static SemanticPatchInstruction RemoveTargetUsers(TargetUser targetUsers)
    {
        return new SemanticPatchInstruction { Kind = FlagInstructionKind.RemoveTargetUsers, Value = targetUsers };
    }
    
    public static SemanticPatchInstruction SetTargetUsers(TargetUser targetUsers)
    {
        return new SemanticPatchInstruction { Kind = FlagInstructionKind.SetTargetUsers, Value = targetUsers };
    }
    
    public static SemanticPatchInstruction AddRule(TargetRule rule)
    {
        return new SemanticPatchInstruction { Kind = FlagInstructionKind.AddRule, Value = rule };
    }
    
    public static SemanticPatchInstruction RemoveRule(string ruleId)
    {
        return new SemanticPatchInstruction { Kind = FlagInstructionKind.RemoveRule, Value = ruleId };
    }
    
    public static SemanticPatchInstruction SetRules(IEnumerable<TargetRule> rules)
    {
        return new SemanticPatchInstruction { Kind = FlagInstructionKind.SetRules, Value = rules };
    }
    
    public static SemanticPatchInstruction UpdateRuleName(string ruleId, string name)
    {
        return new SemanticPatchInstruction { Kind = FlagInstructionKind.UpdateRuleName, Value = new { RuleId = ruleId, Name = name } };
    }
    
    public static SemanticPatchInstruction UpdateRuleDispatchKey(string ruleId, string dispatchKey)
    {
        return new SemanticPatchInstruction { Kind = FlagInstructionKind.UpdateRuleDispatchKey, Value = new { RuleId = ruleId, DispatchKey = dispatchKey } };
    }
    
    public static SemanticPatchInstruction AddRuleConditions(string ruleId, IEnumerable<Condition> conditions)
    {
        return new SemanticPatchInstruction { Kind = FlagInstructionKind.AddRuleConditions, Value = new { RuleId = ruleId, Conditions = conditions } };
    }
    
    public static SemanticPatchInstruction RemoveRuleConditions(string ruleId, IEnumerable<string> conditionIds)
    {
        return new SemanticPatchInstruction { Kind = FlagInstructionKind.RemoveRuleConditions, Value = new { RuleId = ruleId, ConditionIds =  conditionIds} };
    }
    
    public static SemanticPatchInstruction UpdateRuleCondition(string ruleId, Condition condition)
    {
        return new SemanticPatchInstruction { Kind = FlagInstructionKind.UpdateRuleCondition, Value = new { RuleId = ruleId, ConditionId = condition.Id,  Property = condition.Property, Op = condition.Op, Value = condition.Value } };
    }
    
    public static SemanticPatchInstruction AddValuesToRuleCondition(string ruleId, string conditionId, IEnumerable<string> values)
    {
        return new SemanticPatchInstruction { Kind = FlagInstructionKind.AddValuesToRuleCondition, Value = new { RuleId = ruleId, ConditionId = conditionId, Values = values } };
    }
    
    public static SemanticPatchInstruction RemoveValuesFromRuleCondition(string ruleId, string conditionId, IEnumerable<string> values)
    {
        return new SemanticPatchInstruction { Kind = FlagInstructionKind.RemoveValuesFromRuleCondition, Value = new { RuleId = ruleId, ConditionId = conditionId, Values = values } };
    }
    
    public static SemanticPatchInstruction UpdateRuleVariationOrRollouts(string ruleId, IEnumerable<RolloutVariation> variations)
    {
        return new SemanticPatchInstruction { Kind = FlagInstructionKind.UpdateRuleVariationOrRollouts, Value = new { RuleId = ruleId, Values = variations } };
    }
}