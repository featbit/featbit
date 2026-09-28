using Domain.FeatureFlags;

namespace Domain.SemanticPatch;

// Previous contains only retained rules from the draft baseline; Current also includes draft additions.
public record RuleOrder(string[] Previous, string[] Current);

public class RuleOrderConflictException() : InvalidOperationException("The targeting rule order has changed since this draft was created.");

public class ReorderRulesInstruction(RuleOrder value) : FlagInstruction(FlagInstructionKind.ReorderRules, value)
{
    public void EnsureCompatible(FeatureFlag flag)
    {
        var order = (RuleOrder)Value;
        // Draft additions are appended before this instruction runs. Their intermediate positions
        // are not concurrent edits and must not participate in the compatibility check.
        var retained = order.Previous.Intersect(order.Current).ToHashSet();
        var liveOrder = flag.Rules.Where(rule => retained.Contains(rule.Id)).Select(rule => rule.Id).ToArray();
        var existing = liveOrder.ToHashSet();
        if (!liveOrder.SequenceEqual(order.Previous.Where(existing.Contains)) &&
            !liveOrder.SequenceEqual(order.Current.Where(existing.Contains)))
        {
            throw new RuleOrderConflictException();
        }
    }

    public override void Apply(FeatureFlag flag)
    {
        EnsureCompatible(flag);
        var order = (RuleOrder)Value;
        var rulesById = flag.Rules.ToDictionary(rule => rule.Id);
        var ordered = new Queue<Domain.Targeting.TargetRule>(order.Current
            .Where(rulesById.ContainsKey).Select(id => rulesById[id]));
        var affected = order.Current.ToHashSet();
        // Leave subsequently added rules in their live slots; never resurrect deleted rules.
        flag.Rules = flag.Rules.Select(rule => affected.Contains(rule.Id) ? ordered.Dequeue() : rule).ToList();
    }
}
