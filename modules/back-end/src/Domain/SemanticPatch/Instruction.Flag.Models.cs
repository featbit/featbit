using Domain.FeatureFlags;
using Domain.Targeting;

namespace Domain.SemanticPatch;

public class FlagRuleId
{
    public string RuleId { get; set; }
}

public class RuleName : FlagRuleId
{
    public string Name { get; set; }
}

public class RuleDispatchKey : FlagRuleId
{
    public string DispatchKey { get; set; }
}

public class RuleConditionIds : FlagRuleId
{
    public ICollection<string> ConditionIds { get; set; }
}

public class RuleConditions : FlagRuleId
{
    public ICollection<Condition> Conditions { get; set; }
}

public class RuleCondition : FlagRuleId
{
    public Condition Condition { get; set; }
}

public class RuleConditionValues : FlagRuleId
{
    public string ConditionId { get; set; }

    public ICollection<string> Values { get; set; }
}

public class RuleVariations : FlagRuleId
{
    public ICollection<RolloutVariation> RolloutVariations { get; set; }
}