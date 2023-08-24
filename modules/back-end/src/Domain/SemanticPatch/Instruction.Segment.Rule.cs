using Domain.Segments;
using Domain.Targeting;

namespace Domain.SemanticPatch;

public class SetSegmentRulesInstruction : SegmentInstruction
{
    public SetSegmentRulesInstruction(ICollection<MatchRule> value) : base(SegmentInstructionKind.SetRules, value)
    {
    }

    public override void Apply(Segment segment)
    {
        if (Value is not ICollection<MatchRule> rules)
        {
            return;
        }

        segment.Rules = rules;
    }
}

public class AddSegmentRuleInstruction : SegmentInstruction
{
    public AddSegmentRuleInstruction(MatchRule value) : base(SegmentInstructionKind.AddRule, value)
    {
    }

    public override void Apply(Segment segment)
    {
        if (Value is not MatchRule rule)
        {
            return;
        }

        segment.Rules.Add(rule);
    }
}

public class RemoveSegmentRuleInstruction : SegmentInstruction
{
    public RemoveSegmentRuleInstruction(string value) : base(SegmentInstructionKind.RemoveRule, value)
    {
    }

    public override void Apply(Segment segment)
    {
        if (Value is not string ruleId)
        {
            return;
        }

        var ruleToRemove = segment.Rules.FirstOrDefault(r => r.Id == ruleId);
        if (ruleToRemove != null)
        {
            segment.Rules.Remove(ruleToRemove);
        }
    }
}

public class SegmentRuleNameInstruction : SegmentInstruction
{
    public SegmentRuleNameInstruction(RuleName value) : base(SegmentInstructionKind.UpdateRuleName, value)
    {
    }

    public override void Apply(Segment segment)
    {
        if (Value is not RuleName value)
        {
            return;
        }

        var rule = segment.Rules.FirstOrDefault(r => r.Id == value.RuleId);
        if (rule != null)
        {
            rule.Name = value.Name;
        }
    }
}