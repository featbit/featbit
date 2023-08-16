using System.Text.Json;
using Domain.FeatureFlags;
using Domain.Targeting;

namespace Domain.SemanticPatch;


public abstract class Instruction {
    public string Kind { get; set; }
    public object Value { get; set; }
    
    public Instruction()
    {
    }

    protected Instruction(string kind, object value)
    {
        Kind = kind ?? throw new ArgumentNullException(nameof(kind));
        Value = value ?? throw new ArgumentNullException(nameof(value));
    }

    public abstract void Apply(FeatureFlag flag);
}

public class FlagStatusInstruction : Instruction {
    public FlagStatusInstruction(string kind) : base(kind, string.Empty)
    {
    }
    
    public override void Apply(FeatureFlag flag)
    {
        flag.IsEnabled = Kind == FlagInstructionKind.TurnFlagOn;
    }
}

public class FlagArchiveInstruction : Instruction {
    public FlagArchiveInstruction(string kind) : base(kind, string.Empty)
    {
    }
    
    public override void Apply(FeatureFlag flag)
    {
        flag.IsArchived = Kind == FlagInstructionKind.ArchiveFlag;
    }
}

public class FlagNameInstruction : Instruction {
    public FlagNameInstruction(string value) : base(FlagInstructionKind.UpdateName, value)
    {
    }
    
    public override void Apply(FeatureFlag flag)
    {
        if (Value is string name) {
            flag.Name = name;
        }
    }
}

public class FlagDescriptionInstruction : Instruction {
    public FlagDescriptionInstruction(string value) : base(FlagInstructionKind.UpdateDescription, value)
    {
    }
    
    public override void Apply(FeatureFlag flag)
    {
        if (Value is string description) {
            flag.Description = description;
        }
    }
}

public class FlagTagsInstruction : Instruction {
    public FlagTagsInstruction(string kind, ICollection<string> value) : base(kind, value)
    {
    }
    
    public override void Apply(FeatureFlag flag)
    {
        if (Value is not ICollection<string> tags) return;

        flag.Tags = Kind switch
        {
            FlagInstructionKind.AddTags => flag.Tags.Union(tags).ToList(),
            FlagInstructionKind.RemoveTags => flag.Tags.Except(tags).ToList(),
            _ => flag.Tags
        };
    }
}

public class FlagAddVariationInstruction : Instruction {
    public FlagAddVariationInstruction(Variation value) : base(FlagInstructionKind.AddVariation, value)
    {
    }
    
    public override void Apply(FeatureFlag flag)
    {
        if (Value is Variation variation) {
            flag.Variations.Add(variation);
        }
    }
}

public class FlagRemoveVariationInstruction : Instruction {
    public FlagRemoveVariationInstruction(string value) : base(FlagInstructionKind.RemoveVariation, value)
    {
    }
    
    public override void Apply(FeatureFlag flag)
    {
        if (Value is not string variationId) return;
        
        var variationToRemove = flag.Variations.FirstOrDefault(v => v.Id == variationId);
        if (variationToRemove != null)
        {
            flag.Variations.Remove(variationToRemove);
        }
    }
}

public class FlagUpdateVariationInstruction : Instruction {
    public FlagUpdateVariationInstruction(Variation value) : base(FlagInstructionKind.UpdateVariation, value)
    {
    }
    
    public override void Apply(FeatureFlag flag)
    {
        if (Value is not Variation variationToUpdate) return;
        
        var variation = flag.Variations.FirstOrDefault(v => v.Id == variationToUpdate.Id);
        
        if (variation == null) return;
        
        variation.Name = variationToUpdate.Name;
        variation.Value = variationToUpdate.Value;
    }
}

public class FlagVariationTypeInstruction : Instruction {
    public FlagVariationTypeInstruction(string value) : base(FlagInstructionKind.UpdateVariationType, value)
    {
    }
    
    public override void Apply(FeatureFlag flag)
    {
        if (Value is not string variationType) return;

        if (!VariationTypes.IsDefined(variationType)) return;
        
        flag.VariationType = variationType;
    }
}

public class FlagDisabledVariationInstruction : Instruction {
    public FlagDisabledVariationInstruction(string value) : base(FlagInstructionKind.UpdateDisabledVariation, value)
    {
    }
    
    public override void Apply(FeatureFlag flag)
    {
        if (Value is not string variationId) return;
        
        var variation = flag.Variations.FirstOrDefault(v => v.Id == variationId);
        if (variation != null)
        {
            flag.DisabledVariationId = variationId;
        }
    }
}

public class FlagDefaultVariationInstruction : Instruction {
    public FlagDefaultVariationInstruction(Fallthrough value) : base(FlagInstructionKind.UpdateDefaultVariation, value)
    {
    }
    
    public override void Apply(FeatureFlag flag)
    {
        if (Value is Fallthrough fallthrough) {
            flag.Fallthrough = fallthrough;
        }
    }
}

public class FlagTargetUsersInstruction : Instruction {
    public FlagTargetUsersInstruction(string kind, TargetUser value) : base(kind, value)
    {
    }
    
    public override void Apply(FeatureFlag flag)
    {
        if (Value is not TargetUser targetUser) return;

        switch (Kind)
        {
            case FlagInstructionKind.SetTargetUsers:
                SetTargetUsers(flag, targetUser);
                break;
            case FlagInstructionKind.AddTargetUsers:
                AddTargetUsers(flag, targetUser);
                break;
            case FlagInstructionKind.RemoveTargetUsers:
                RemoveTargetUsers(flag, targetUser);
                break;
            
        }
    }
    
    private void RemoveTargetUsers(FeatureFlag flag, TargetUser targetUser)
    {
        var targetUserForRemove = flag.TargetUsers.FirstOrDefault(x => x.VariationId == targetUser.VariationId);
        
        if (targetUserForRemove != null)
        {
            targetUserForRemove.KeyIds = targetUserForRemove.KeyIds.Except(targetUser.KeyIds).ToList();
        }
    }
    
    private void AddTargetUsers(FeatureFlag flag, TargetUser targetUser)
    {
        var targetUserForAdd = flag.TargetUsers.FirstOrDefault(x => x.VariationId == targetUser.VariationId);
        
        if (targetUserForAdd != null)
        {
            targetUserForAdd.KeyIds = targetUserForAdd.KeyIds.Union(targetUser.KeyIds).ToList();
        }
        else
        {
            flag.TargetUsers.Add(targetUser);
        }
    }
    
    private void SetTargetUsers(FeatureFlag flag, TargetUser targetUser)
    {
        var targetUserForSet = flag.TargetUsers.FirstOrDefault(x => x.VariationId == targetUser.VariationId);
        
        if (targetUserForSet != null)
        {
            targetUserForSet.KeyIds = targetUser.KeyIds;
        }
        else
        {
            flag.TargetUsers.Add(targetUser);
        }
    }
}

public class FlagAddRuleInstruction : Instruction {
    public FlagAddRuleInstruction(TargetRule value) : base(FlagInstructionKind.AddRule, value)
    {
    }
    
    public override void Apply(FeatureFlag flag)
    {
        if (Value is not TargetRule rule) return;

        flag.Rules.Add(rule);
    }
}

public class FlagRemoveRuleInstruction : Instruction {
    public FlagRemoveRuleInstruction(string value) : base(FlagInstructionKind.RemoveRule, value)
    {
    }
    
    public override void Apply(FeatureFlag flag)
    {
        if (Value is not string ruleId) return;

        var ruleToRemove = flag.Rules.FirstOrDefault(r => r.Id == ruleId);
        if (ruleToRemove != null)
        {
            flag.Rules.Remove(ruleToRemove);
        }
    }
}

public class FlagSetRulesInstruction : Instruction {
    public FlagSetRulesInstruction(ICollection<TargetRule> value) : base(FlagInstructionKind.SetRules, value)
    {
    }
    
    public override void Apply(FeatureFlag flag)
    {
        if (Value is not ICollection<TargetRule> rules) return;

        flag.Rules = rules.ToList();
    }
}

public class FlagRuleValue
{
    public string RuleId { get; set; }
}

public class FlagRuleName: FlagRuleValue
{
    public string Name { get; set; }
}

public class FlagRuleDispatchKey: FlagRuleValue
{
    public string DispatchKey { get; set; }
}

public class FlagRuleConditionIds: FlagRuleValue
{
    public ICollection<string> ConditionIds { get; set; }
}

public class FlagRuleConditions: FlagRuleValue
{
    public ICollection<Condition> Conditions { get; set; }
}

public class FlagRuleCondition: FlagRuleValue
{
    public Condition Condition { get; set; }
}

public class FlagRuleConditionValues: FlagRuleValue
{
    public string ConditionId { get; set; }
    public ICollection<string> Values { get; set; }
}

public class FlagRuleVariations: FlagRuleValue
{
    public ICollection<RolloutVariation> RolloutVariations { get; set; }
}

public class FlagRuleNameInstruction : Instruction {
    public FlagRuleNameInstruction(FlagRuleName value) : base(FlagInstructionKind.UpdateRuleName, value)
    {
    }

    public override void Apply(FeatureFlag flag)
    {
        if (Value is not FlagRuleName value) return;
        
        var rule = flag.Rules.FirstOrDefault(r => r.Id == value.RuleId);
        
        if (rule != null)
        {
            rule.Name = value.Name;
        }
    }
}

public class FlagRuleDispatchKeyInstruction : Instruction {
    public FlagRuleDispatchKeyInstruction(FlagRuleDispatchKey value) : base(FlagInstructionKind.UpdateRuleDispatchKey, value)
    {
    }

    public override void Apply(FeatureFlag flag)
    {
        if (Value is not FlagRuleDispatchKey value) return;
        
        var rule = flag.Rules.FirstOrDefault(r => r.Id == value.RuleId);
        
        if (rule != null)
        {
            rule.DispatchKey = value.DispatchKey;
        }
    }
}

public class FlagRemoveRuleConditionsInstruction : Instruction {
    public FlagRemoveRuleConditionsInstruction(FlagRuleConditionIds value) : base(FlagInstructionKind.RemoveRuleConditions, value)
    {
    }

    public override void Apply(FeatureFlag flag)
    {
        if (Value is not FlagRuleConditionIds value) return;
        
        var rule = flag.Rules.FirstOrDefault(r => r.Id == value.RuleId);

        ((List<Condition>)rule?.Conditions)?.RemoveAll(c => value.ConditionIds.Contains(c.Id));
    }
}

public class FlagAddRuleConditionsInstruction : Instruction {
    public FlagAddRuleConditionsInstruction(FlagRuleConditions value) : base(FlagInstructionKind.AddRuleConditions, value)
    {
    }

    public override void Apply(FeatureFlag flag)
    {
        if (Value is not FlagRuleConditions value) return;
        
        var rule = flag.Rules.FirstOrDefault(r => r.Id == value.RuleId);

        ((List<Condition>)rule?.Conditions)?.AddRange(value.Conditions);
    }
}

public class FlagUpdateRuleConditionInstruction : Instruction {
    public FlagUpdateRuleConditionInstruction(FlagRuleCondition value) : base(FlagInstructionKind.UpdateRuleCondition, value)
    {
    }

    public override void Apply(FeatureFlag flag)
    {
        if (Value is not FlagRuleCondition value) return;
        
        var rule = flag.Rules.FirstOrDefault(r => r.Id == value.RuleId);

        if (rule != null)
        {
            var condition = rule.Conditions.FirstOrDefault(c => c.Id == value.Condition.Id);
            
            if (condition == null) return;
            
            condition.Property = value.Condition.Property;
            condition.Op = value.Condition.Op;
            condition.Value = value.Condition.Value;
        }
    }
}

public class FlagRemoveValuesFromRuleConditionInstruction : Instruction {
    public FlagRemoveValuesFromRuleConditionInstruction(FlagRuleConditionValues value) : base(FlagInstructionKind.RemoveValuesFromRuleCondition, value)
    {
    }

    public override void Apply(FeatureFlag flag)
    {
        if (Value is not FlagRuleConditionValues value) return;
        
        var rule = flag.Rules.FirstOrDefault(r => r.Id == value.RuleId);

        if (rule != null)
        {
            var condition = rule.Conditions.FirstOrDefault(c => c.Id == value.ConditionId);
            
            if (condition == null) return;
            
            var originalValues = JsonSerializer.Deserialize<IEnumerable<string>>(condition.Value, ReusableJsonSerializerOptions.Web);

            if (!((List<string>)value.Values).Any()) return;
            
            ((List<string>)originalValues).RemoveAll(v => value.Values.Contains(v));
            condition.Value = JsonSerializer.Serialize(originalValues, ReusableJsonSerializerOptions.Web);
        }
    }
}

public class FlagAddValuesToRuleConditionInstruction : Instruction {
    public FlagAddValuesToRuleConditionInstruction(FlagRuleConditionValues value) : base(FlagInstructionKind.AddValuesToRuleCondition, value)
    {
    }

    public override void Apply(FeatureFlag flag)
    {
        if (Value is not FlagRuleConditionValues value) return;
        
        var rule = flag.Rules.FirstOrDefault(r => r.Id == value.RuleId);

        if (rule != null)
        {
            var condition = rule.Conditions.FirstOrDefault(c => c.Id == value.ConditionId);
            
            if (condition == null) return;
            
            var originalValues = JsonSerializer.Deserialize<IEnumerable<string>>(condition.Value, ReusableJsonSerializerOptions.Web);

            if (!((List<string>)value.Values).Any()) return;
            
            ((List<string>)originalValues).AddRange(value.Values);
            condition.Value = JsonSerializer.Serialize(originalValues, ReusableJsonSerializerOptions.Web);
        }
    }
}

public class FlagUpdateRuleVariationOrRolloutInstruction : Instruction {
    public FlagUpdateRuleVariationOrRolloutInstruction(FlagRuleVariations value) : base(FlagInstructionKind.UpdateRuleVariationOrRollouts, value)
    {
    }

    public override void Apply(FeatureFlag flag)
    {
        if (Value is not FlagRuleVariations value) return;
        
        var rule = flag.Rules.FirstOrDefault(r => r.Id == value.RuleId);

        if (rule == null) return;
        
        ((List<RolloutVariation>)rule.Variations).Clear();
        ((List<RolloutVariation>)rule.Variations).AddRange(value.RolloutVariations);
    }
}