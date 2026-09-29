using Domain.FeatureFlags;
using Domain.Targeting;

namespace Domain.SemanticPatch;

/// <summary>
/// A rule reorder captured when a draft is created. Both lists are draft-time snapshots, not live state.
/// </summary>
/// <remarks>
/// Compatibility is checked only for rules present in both snapshots that still exist in the live flag.
/// Their live order must match either the baseline or the desired order, allowing repeated application.
/// Reordering preserves the live slots of rules outside Current and never restores deleted rules.
/// </remarks>
/// <param name="Previous">Baseline order of the rules the draft retains, excluding rules it adds or deletes.</param>
/// <param name="Current">Order the draft wants, including rules it adds; it is the reorder target.</param>
public record RuleOrder(string[] Previous, string[] Current);

public class RuleOrderConflictException()
    : InvalidOperationException("The targeting rule order has changed since this draft was created.");

public class ReorderRulesInstruction(RuleOrder value) : FlagInstruction(FlagInstructionKind.ReorderRules, value)
{
    public void EnsureCompatible(FeatureFlag flag)
    {
        var draftRuleOrder = (RuleOrder)Value;

        var retainedRuleIds = draftRuleOrder.Previous.Intersect(draftRuleOrder.Current).ToHashSet();

        var liveRetainedOrder = flag.Rules.Where(rule => retainedRuleIds.Contains(rule.Id))
            .Select(rule => rule.Id)
            .ToArray();

        var survivingRetainedRuleIds = liveRetainedOrder.ToHashSet();
        var baselineOrder = draftRuleOrder.Previous.Where(survivingRetainedRuleIds.Contains);
        var desiredOrder = draftRuleOrder.Current.Where(survivingRetainedRuleIds.Contains);

        var matchesBaseline = liveRetainedOrder.SequenceEqual(baselineOrder);
        var alreadyInDesiredOrder = liveRetainedOrder.SequenceEqual(desiredOrder);

        if (!matchesBaseline && !alreadyInDesiredOrder)
        {
            throw new RuleOrderConflictException();
        }
    }

    public override void Apply(FeatureFlag flag)
    {
        EnsureCompatible(flag);

        var draftRuleOrder = (RuleOrder)Value;

        var rulesById = flag.Rules.ToDictionary(rule => rule.Id);

        // Only use rules that still exist in the live flag; never restore deleted rules.
        var rulesInDesiredOrder = new Queue<TargetRule>(
            draftRuleOrder.Current.Where(rulesById.ContainsKey).Select(id => rulesById[id])
        );
        var reorderedRuleIds = draftRuleOrder.Current.ToHashSet();

        // For a draft changing [A, B, C] to [D, C, B, A], D is added before this step.
        // A live list [A, X, B, C, D] becomes [D, X, C, B, A]: X keeps its live slot.
        var reorderedRules = new List<TargetRule>();

        foreach (var liveRule in flag.Rules)
        {
            var participatesInReorder = reorderedRuleIds.Contains(liveRule.Id);
            var rule = participatesInReorder
                ? rulesInDesiredOrder.Dequeue()
                : liveRule;

            reorderedRules.Add(rule);
        }

        flag.Rules = reorderedRules;
    }
}
