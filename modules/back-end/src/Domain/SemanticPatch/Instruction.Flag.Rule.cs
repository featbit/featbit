using Domain.FeatureFlags;
using Domain.Targeting;

namespace Domain.SemanticPatch;

public class AddRuleInstruction : FlagInstruction
{
    public AddRuleInstruction(TargetRule value) : base(FlagInstructionKind.AddRule, value)
    {
    }

    public override void Apply(FeatureFlag flag)
    {
        if (Value is not TargetRule rule)
        {
            return;
        }

        flag.Rules.Add(rule);
    }
}

public class RemoveRuleInstruction : FlagInstruction
{
    public RemoveRuleInstruction(string value) : base(FlagInstructionKind.RemoveRule, value)
    {
    }

    public override void Apply(FeatureFlag flag)
    {
        if (Value is not string ruleId)
        {
            return;
        }

        var ruleToRemove = flag.Rules.FirstOrDefault(r => r.Id == ruleId);
        if (ruleToRemove != null)
        {
            flag.Rules.Remove(ruleToRemove);
        }
    }
}

public class SetRulesInstruction : FlagInstruction
{
    public SetRulesInstruction(ICollection<TargetRule> value) : base(FlagInstructionKind.SetRules, value)
    {
    }

    public override void Apply(FeatureFlag flag)
    {
        if (Value is not ICollection<TargetRule> rules)
        {
            return;
        }

        flag.Rules = rules;
    }
}

public class RuleNameInstruction : FlagInstruction
{
    public RuleNameInstruction(RuleName value) : base(FlagInstructionKind.UpdateRuleName, value)
    {
    }

    public override void Apply(FeatureFlag flag)
    {
        if (Value is not RuleName value)
        {
            return;
        }

        var rule = flag.Rules.FirstOrDefault(r => r.Id == value.RuleId);
        if (rule != null)
        {
            rule.Name = value.Name;
        }
    }
}

public class RuleDispatchKeyInstruction : FlagInstruction
{
    public RuleDispatchKeyInstruction(RuleDispatchKey value) : base(FlagInstructionKind.UpdateRuleDispatchKey, value)
    {
    }

    public override void Apply(FeatureFlag flag)
    {
        if (Value is not RuleDispatchKey value)
        {
            return;
        }

        var rule = flag.Rules.FirstOrDefault(r => r.Id == value.RuleId);
        if (rule != null)
        {
            rule.DispatchKey = value.DispatchKey;
        }
    }
}

public class UpdateDefaultRuleDispatchKeyInstruction : FlagInstruction
{
    public UpdateDefaultRuleDispatchKeyInstruction(string value) : base(FlagInstructionKind.UpdateDefaultRuleDispatchKey, value)
    {
    }

    public override void Apply(FeatureFlag flag)
    {
        if (Value is not string value)
        {
            return;
        }

        flag.Fallthrough.DispatchKey = value;
    }
}