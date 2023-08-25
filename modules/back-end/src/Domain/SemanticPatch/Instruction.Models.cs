using Domain.FeatureFlags;
using Domain.Targeting;

namespace Domain.SemanticPatch;

public class TheRuleId
{
    public string RuleId { get; set; }
}

public class RuleName : TheRuleId
{
    public string Name { get; set; }
}

public class RuleDispatchKey : TheRuleId
{
    public string DispatchKey { get; set; }
}

public class RuleConditionIds : TheRuleId
{
    public ICollection<string> ConditionIds { get; set; }
}

public class RuleConditions : TheRuleId
{
    public ICollection<Condition> Conditions { get; set; }
}

public class RuleCondition : TheRuleId
{
    public Condition Condition { get; set; }
}

public class RuleConditionValues : TheRuleId
{
    public string ConditionId { get; set; }

    public ICollection<string> Values { get; set; }
}

public class RuleVariations : TheRuleId
{
    public ICollection<RolloutVariation> RolloutVariations { get; set; }
}

public class DefaultRuleRolloutVariations
{
    public ICollection<RolloutVariation> RolloutVariations { get; set; }
}