using System.Text.Json;
using Domain.FeatureFlags;

namespace Domain.SemanticPatch;

public class RemoveConditionsInstruction : FlagInstruction
{
    public RemoveConditionsInstruction(RuleConditionIds value) : base(FlagInstructionKind.RemoveRuleConditions, value)
    {
    }

    public override void Apply(FeatureFlag flag)
    {
        if (Value is not RuleConditionIds conditionsToRemove)
        {
            return;
        }

        var rule = flag.Rules.FirstOrDefault(r => r.Id == conditionsToRemove.RuleId);
        if (rule == null)
        {
            return;
        }

        rule.Conditions = rule.Conditions.Where(c => !conditionsToRemove.ConditionIds.Contains(c.Id)).ToList();
    }
}

public class AddConditionsInstruction : FlagInstruction
{
    public AddConditionsInstruction(RuleConditions value) : base(FlagInstructionKind.AddRuleConditions, value)
    {
    }

    public override void Apply(FeatureFlag flag)
    {
        if (Value is not RuleConditions conditionsToAdd)
        {
            return;
        }

        var rule = flag.Rules.FirstOrDefault(r => r.Id == conditionsToAdd.RuleId);
        if (rule == null)
        {
            return;
        }

        foreach (var condition in conditionsToAdd.Conditions)
        {
            rule.Conditions.Add(condition);
        }
    }
}

public class UpdateConditionInstruction : FlagInstruction
{
    public UpdateConditionInstruction(RuleCondition value) : base(FlagInstructionKind.UpdateRuleCondition, value)
    {
    }

    public override void Apply(FeatureFlag flag)
    {
        if (Value is not RuleCondition value)
        {
            return;
        }

        var rule = flag.Rules.FirstOrDefault(r => r.Id == value.RuleId);
        var current = value.Condition;

        var original = rule?.Conditions.FirstOrDefault(c => c.Id == current.Id);
        original?.Assign(current);
    }
}

public class RuleConditionValuesInstruction : FlagInstruction
{
    public RuleConditionValuesInstruction(string kind, RuleConditionValues value) : base(kind, value)
    {
    }

    public override void Apply(FeatureFlag flag)
    {
        if (Value is not RuleConditionValues value)
        {
            return;
        }

        var rule = flag.Rules.FirstOrDefault(r => r.Id == value.RuleId);

        var condition = rule?.Conditions.FirstOrDefault(c => c.Id == value.ConditionId);
        if (condition == null)
        {
            return;
        }

        if (value.Values.Count == 0)
        {
            return;
        }

        var originalValues = JsonSerializer.Deserialize<List<string>>(condition.Value);

        switch (Kind)
        {
            case FlagInstructionKind.AddValuesToRuleCondition:
                originalValues.AddRange(value.Values);
                break;
            case FlagInstructionKind.RemoveValuesFromRuleCondition:
                originalValues.RemoveAll(v => value.Values.Contains(v));
                break;
        }

        condition.Value = JsonSerializer.Serialize(originalValues);
    }
}

