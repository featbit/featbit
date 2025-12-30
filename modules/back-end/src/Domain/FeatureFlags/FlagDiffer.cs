using System.Text.Json;
using Domain.Segments;
using Domain.Targeting;

namespace Domain.FeatureFlags;

public record CompareServeVariationsParameter(
    Guid Id,
    ICollection<Variation> Variations,
    ICollection<RolloutVariation> ServeVariations
);

public static class FlagDiffer
{
    public static FlagDiff Diff(FeatureFlag source, FeatureFlag target, ICollection<Segment> relatedSegments)
    {
        var onOffDiff = CompareOnOff(source, target);
        var individualTargetingDiff = CompareIndividualTargeting(source, target);
        var targetingRulesDiff = CompareRules(source, target, relatedSegments);
        var defaultRuleDiff = CompareDefaultRule(source, target);
        var offVariationDiff = CompareOffVariation(source, target);

        return new FlagDiff(
            onOffDiff,
            individualTargetingDiff,
            targetingRulesDiff,
            defaultRuleDiff,
            offVariationDiff
        );
    }

    public static OnOffDiff CompareOnOff(FeatureFlag source, FeatureFlag target) =>
        new(source.IsEnabled, target.IsEnabled, source.IsEnabled != target.IsEnabled);

    public static List<IndividualTargetingDiff> CompareIndividualTargeting(FeatureFlag source, FeatureFlag target)
    {
        var diffs = new List<IndividualTargetingDiff>();

        foreach (var srcVariation in source.Variations)
        {
            var srcUsers = source.TargetUsers.Where(x => x.VariationId == srcVariation.Id)
                .SelectMany(x => x.KeyIds)
                .ToArray();

            IndividualTargetingDiff diff;
            var targetVariation = target.Variations.FirstOrDefault(v => v.Value == srcVariation.Value);
            if (targetVariation == null)
            {
                diff = new IndividualTargetingDiff(
                    new VariationUsers(srcVariation, srcUsers),
                    null,
                    srcUsers.Length != 0
                );
            }
            else
            {
                var targetUsers = target.TargetUsers.Where(x => x.VariationId == targetVariation.Id)
                    .SelectMany(x => x.KeyIds)
                    .ToArray();

                diff = new IndividualTargetingDiff(
                    new VariationUsers(srcVariation, srcUsers),
                    new VariationUsers(targetVariation, targetUsers),
                    !srcUsers.AreEquivalent(targetUsers)
                );
            }

            diffs.Add(diff);
        }

        // variations may in target flag that are not in source flag
        var newVariations = target.Variations
            .Where(tv => source.Variations.All(sv => sv.Value != tv.Value))
            .ToArray();

        foreach (var newVariation in newVariations)
        {
            var targetUsers = target.TargetUsers
                .Where(x => x.VariationId == newVariation.Id)
                .SelectMany(x => x.KeyIds)
                .OrderBy(x => x)
                .ToArray();

            var diff = new IndividualTargetingDiff(
                null,
                new VariationUsers(newVariation, targetUsers),
                targetUsers.Length != 0
            );

            diffs.Add(diff);
        }

        return diffs;
    }

    public static List<TargetingRuleDiff> CompareRules(
        FeatureFlag source,
        FeatureFlag target,
        ICollection<Segment> relatedSegments)
    {
        var diffs = new List<TargetingRuleDiff>();

        foreach (var sourceRule in source.Rules)
        {
            TargetingRuleDiff diff;

            // find target rule with same conditions
            var targetRule =
                target.Rules.FirstOrDefault(rule => IsSameConditions(sourceRule.Conditions, rule.Conditions, relatedSegments));
            if (targetRule == null)
            {
                diff = new TargetingRuleDiff(sourceRule, null, true);
            }
            else
            {
                var srcSvp = new CompareServeVariationsParameter(
                    source.Id,
                    source.Variations,
                    sourceRule.Variations
                );
                var targetSvp = new CompareServeVariationsParameter(
                    target.Id,
                    target.Variations,
                    targetRule.Variations
                );

                var hasDiff = IsServeVariationsDifferent(srcSvp, targetSvp);
                diff = new TargetingRuleDiff(sourceRule, targetRule, hasDiff);
            }

            diffs.Add(diff);
        }

        // rules may in target flag that are not in source flag
        var comparedTargetRules = diffs
            .Where(x => x.Target != null)
            .Select(x => x.Target.Id)
            .ToArray();
        var newRules = target.Rules
            .Where(tr => !comparedTargetRules.Contains(tr.Id))
            .ToArray();

        diffs.AddRange(
            newRules.Select(targetRule => new TargetingRuleDiff(null, targetRule, true))
        );

        return diffs;
    }

    public static DefaultRuleDiff CompareDefaultRule(FeatureFlag source, FeatureFlag target)
    {
        var sourceDefaultRule = source.Fallthrough;
        var targetDefaultRule = target.Fallthrough;

        var sourceDispatchKey = string.IsNullOrWhiteSpace(sourceDefaultRule.DispatchKey)
            ? "keyId"
            : sourceDefaultRule.DispatchKey;
        var targetDispatchKey = string.IsNullOrWhiteSpace(targetDefaultRule.DispatchKey)
            ? "keyId"
            : targetDefaultRule.DispatchKey;

        if (sourceDispatchKey != targetDispatchKey)
        {
            return new DefaultRuleDiff(sourceDefaultRule, targetDefaultRule, true);
        }

        var srcSvp = new CompareServeVariationsParameter(
            source.Id,
            source.Variations,
            sourceDefaultRule.Variations
        );
        var targetSvp = new CompareServeVariationsParameter(
            target.Id,
            target.Variations,
            targetDefaultRule.Variations
        );

        var hasDiff = IsServeVariationsDifferent(srcSvp, targetSvp);
        return new DefaultRuleDiff(sourceDefaultRule, targetDefaultRule, hasDiff);
    }

    public static OffVariationDiff CompareOffVariation(FeatureFlag source, FeatureFlag target)
    {
        var srcOffVariation = source.Variations.FirstOrDefault(v => v.Id == source.DisabledVariationId);
        if (srcOffVariation == null)
        {
            throw new Exception(
                $"Inconsistent data: disabled variation not found in source flag. Flag Id: {source.Id}."
            );
        }

        var targetOffVariation = target.Variations.FirstOrDefault(v => v.Id == target.DisabledVariationId);
        if (targetOffVariation == null)
        {
            throw new Exception(
                $"Inconsistent data: disabled variation not found in target flag. Flag Id: {target.Id}."
            );
        }

        var hasDiff = srcOffVariation.Value != targetOffVariation.Value;
        return new OffVariationDiff(srcOffVariation, targetOffVariation, hasDiff);
    }

    public static bool IsSameConditions(
        ICollection<Condition> sourceConditions,
        ICollection<Condition> targetConditions,
        ICollection<Segment> relatedSegments)
    {
        if (sourceConditions.Count != targetConditions.Count)
        {
            return false;
        }

        foreach (var source in sourceConditions)
        {
            if (!FindSameCondition(source))
            {
                return false;
            }
        }

        return true;

        bool FindSameCondition(Condition source)
        {
            // find similar conditions in target conditions
            var similarConditions = targetConditions.Where(condition =>
                condition.Property == source.Property &&
                condition.Op == source.Op
            );

            // compare segment condition values
            foreach (var similarCondition in similarConditions)
            {
                if (!source.IsMultiValue() && source.Value == similarCondition.Value)
                {
                    return true;
                }

                if (source.IsSegmentCondition())
                {
                    var srcSegmentIds = JsonSerializer.Deserialize<string[]>(source.Value);
                    var targetSegmentIds = JsonSerializer.Deserialize<string[]>(similarCondition.Value);

                    var srcSegments = relatedSegments
                        .Where(s => srcSegmentIds.Contains(s.Id.ToString()))
                        .Select(s => s.Name)
                        .ToArray();
                    var targetSegments = relatedSegments
                        .Where(s => targetSegmentIds.Contains(s.Id.ToString()))
                        .Select(s => s.Name)
                        .ToArray();

                    if (srcSegments.AreEquivalent(targetSegments))
                    {
                        return true;
                    }
                }

                if (source.IsMultiValue())
                {
                    var srcValues = JsonSerializer.Deserialize<string[]>(source.Value);
                    var targetValues = JsonSerializer.Deserialize<string[]>(similarCondition.Value);

                    if (srcValues.AreEquivalent(targetValues))
                    {
                        return true;
                    }
                }
            }

            return false;
        }
    }

    private static bool IsServeVariationsDifferent(
        CompareServeVariationsParameter source,
        CompareServeVariationsParameter target)
    {
        foreach (var srcServeVariation in source.ServeVariations)
        {
            var srcVariation = source.Variations.FirstOrDefault(v => v.Id == srcServeVariation.Id);
            if (srcVariation == null)
            {
                throw new Exception($"Inconsistent data: variation not found in flag. Flag Id: {source.Id}.");
            }

            var targetVariation = target.Variations.FirstOrDefault(v => v.Value == srcVariation.Value);
            if (targetVariation == null)
            {
                return true;
            }

            var targetServeVariation = target.ServeVariations.FirstOrDefault(v => v.Id == targetVariation.Id);
            if (targetServeVariation == null)
            {
                return true;
            }

            if (!srcServeVariation.IsRolloutEquals(targetServeVariation))
            {
                return true;
            }
        }

        return false;
    }
}