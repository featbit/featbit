using System.Text.Json;
using Domain.EndUsers;
using Domain.Resources;
using Domain.Segments;
using Domain.Targeting;

namespace Domain.FeatureFlags;

public record FlagCopyContext(
    FeatureFlag Source,
    FeatureFlag Target,
    ICollection<Segment> RelatedSegments,
    FlagSettingCopyOptions Options
);

public class FlagCopyHelper
{
    public static bool IsRulesCopyable(
        ICollection<TargetRule> sourceRules,
        ICollection<Segment> relatedSegments,
        string targetEnvRN)
    {
        if (sourceRules.Count == 0)
        {
            // if there are no rules, return true
            return true;
        }

        var segmentConditions = sourceRules.SelectMany(x => x.Conditions)
            .Where(x => x.IsSegmentCondition())
            .ToArray();
        if (segmentConditions.Length == 0)
        {
            // if there are no segment conditions, return true
            return true;
        }

        var segmentIds = segmentConditions
            .SelectMany(x => JsonSerializer.Deserialize<string[]>(x.Value))
            .Select(Guid.Parse)
            .ToArray();

        var segments = relatedSegments.Where(x => segmentIds.Contains(x.Id)).ToArray();
        if (segments.Any(x => x.Type == SegmentType.EnvironmentSpecific))
        {
            // if there are environment-specific segments, return false
            return false;
        }

        var sharedSegments = segments.Where(x => x.Type == SegmentType.Shared).ToArray();
        if (sharedSegments.Any(sharedSegment => sharedSegment.Scopes.All(x => !RN.IsInScope(targetEnvRN, x))))
        {
            // if any shared segment cannot be used in target env, return false
            return false;
        }

        return true;
    }

    public static ICollection<string> GetNewProperties(
        ICollection<TargetRule> sourceRules,
        ICollection<EndUserProperty> targetEnvProperties)
    {
        if (sourceRules.Count == 0)
        {
            return [];
        }

        var propertyNames = sourceRules.SelectMany(x => x.Conditions)
            // exclude segment conditions
            .Where(x => !x.IsSegmentCondition())
            .Select(x => x.Property)
            .Distinct()
            .ToArray();

        if (propertyNames.Length == 0)
        {
            return [];
        }

        var newProperties = propertyNames
            .Where(x => targetEnvProperties.All(y => y.Name != x))
            .ToArray();

        return newProperties;
    }

    public static void CopySettings(FlagCopyContext ctx)
    {
        var (source, target, relatedSegments, options) = ctx;
        var (onOffState, individualTargetingOption, targetRulesOptions, defaultRule, offVariation) = options;

        if (onOffState)
        {
            target.IsEnabled = source.IsEnabled;
        }

        // Copy missing variations from source to target
        var missingVariationsInTarget = source.Variations
            .Where(sv => target.Variations.All(tv => tv.Value != sv.Value))
            .ToArray();
        target.Variations = target.Variations.Concat(missingVariationsInTarget).ToArray();

        if (individualTargetingOption.Copy)
        {
            CopyTargetUsers(source, target, individualTargetingOption.Mode);
        }

        if (targetRulesOptions.Copy)
        {
            CopyRules(source, target, relatedSegments, targetRulesOptions.Mode);
        }

        if (defaultRule)
        {
            CopyDefaultRule(source, target);
        }

        if (offVariation)
        {
            CopyOffVariation(source, target);
        }
    }

    static void CopyTargetUsers(FeatureFlag source, FeatureFlag target, string copyMode)
    {
        ICollection<TargetUser> newTargetUsers = [];

        foreach (var targetVariation in target.Variations)
        {
            var sourceKeyIds = source.TargetUsers.FirstOrDefault(stu =>
            {
                var sourceVariation = source.Variations.FirstOrDefault(x => x.Value == targetVariation.Value);
                return sourceVariation?.Id == stu.VariationId;
            })?.KeyIds ?? [];

            if (copyMode == CopyModes.Overwrite)
            {
                newTargetUsers.Add(new TargetUser
                {
                    VariationId = targetVariation.Id,
                    KeyIds = sourceKeyIds
                });
            }
            else
            {
                var targetKeyIds =
                    target.TargetUsers.FirstOrDefault(ttu => ttu.VariationId == targetVariation.Id)?.KeyIds ?? [];

                var keyIds = targetKeyIds.Concat(sourceKeyIds).Distinct().ToArray();

                newTargetUsers.Add(new TargetUser
                {
                    VariationId = targetVariation.Id,
                    KeyIds = keyIds
                });
            }
        }

        target.TargetUsers = newTargetUsers;
    }

    static void CopyRules(
        FeatureFlag source, 
        FeatureFlag target, 
        ICollection<Segment> relatedSegments, 
        string copyMode)
    {
        if (copyMode == CopyModes.Overwrite)
        {
            target.Rules = source.Rules.Select(MapSourceRule).ToArray();
            return;
        }

        // append mode
        var newRules = new List<TargetRule>();

        // add existing target rules first
        newRules.AddRange(target.Rules);

        // add different source rules
        var ruleDiffs = FlagDiffer.CompareRules(source, target, relatedSegments);
        newRules.AddRange(
            from sourceRule in source.Rules
            let diff = ruleDiffs.First(x => x.Source?.Id == sourceRule.Id)
            where diff.IsDifferent
            select MapSourceRule(sourceRule)
        );

        target.Rules = newRules;
        return;

        TargetRule MapSourceRule(TargetRule rule)
        {
            var newVariations = rule.Variations.Select(sv =>
            {
                var sourceVariation = source.Variations.First(v => v.Id == sv.Id);
                var targetVariation = target.Variations.First(tv => tv.Value == sourceVariation.Value);
                return new RolloutVariation
                {
                    Id = targetVariation.Id,
                    Rollout = sv.Rollout,
                    ExptRollout = sv.ExptRollout
                };
            }).ToArray();

            rule.Id = Guid.NewGuid().ToString("D");
            rule.Variations = newVariations;

            return rule;
        }
    }

    static void CopyDefaultRule(FeatureFlag source, FeatureFlag target)
    {
        source.Fallthrough.Variations = source.Fallthrough.Variations.Select(sv =>
            {
                var sourceVariation = source.Variations.First(v => v.Id == sv.Id);
                var targetVariation = target.Variations.First(tv => tv.Value == sourceVariation.Value);
                return new RolloutVariation
                {
                    Id = targetVariation.Id,
                    Rollout = sv.Rollout,
                    ExptRollout = sv.ExptRollout
                };
            })
            .ToArray();

        target.Fallthrough = source.Fallthrough;
    }

    static void CopyOffVariation(FeatureFlag source, FeatureFlag target)
    {
        var sourceVariation = source.Variations.First(v => v.Id == source.DisabledVariationId);
        var targetVariation = target.Variations.First(tv => tv.Value == sourceVariation.Value);

        target.DisabledVariationId = targetVariation.Id;
    }
}