using System.Text.Json;
using Domain.Segments;

namespace Domain.SemanticPatch;

public class SegmentRemoveConditionsInstruction : SegmentInstruction
{
    public SegmentRemoveConditionsInstruction(RuleConditionIds value) : base(SegmentInstructionKind.RemoveRuleConditions, value)
    {
    }

    public override void Apply(Segment flag)
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

public class SegmentAddConditionsInstruction : SegmentInstruction
{
    public SegmentAddConditionsInstruction(RuleConditions value) : base(SegmentInstructionKind.AddRuleConditions, value)
    {
    }

    public override void Apply(Segment flag)
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

public class SegmentUpdateConditionInstruction : SegmentInstruction
{
    public SegmentUpdateConditionInstruction(RuleCondition value) : base(SegmentInstructionKind.UpdateRuleCondition, value)
    {
    }

    public override void Apply(Segment flag)
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

public class SegmentRemoveValuesFromConditionInstruction : SegmentInstruction
{
    public SegmentRemoveValuesFromConditionInstruction(RuleConditionValues value) : base(SegmentInstructionKind.RemoveValuesFromRuleCondition, value)
    {
    }

    public override void Apply(Segment flag)
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
        originalValues.RemoveAll(v => value.Values.Contains(v));

        condition.Value = JsonSerializer.Serialize(originalValues);
    }
}

public class SegmentAddValuesToConditionInstruction : SegmentInstruction
{
    public SegmentAddValuesToConditionInstruction(RuleConditionValues value) : base(SegmentInstructionKind.AddValuesToRuleCondition, value)
    {
    }

    public override void Apply(Segment flag)
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
        originalValues.AddRange(value.Values);

        condition.Value = JsonSerializer.Serialize(originalValues);
    }
}