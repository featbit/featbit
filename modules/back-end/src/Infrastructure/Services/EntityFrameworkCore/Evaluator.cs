using System.Text.Json;
using Domain.EndUsers;
using Domain.FeatureFlags;
using Domain.Segments;
using Domain.Targeting;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Services.EntityFrameworkCore;

public class Evaluator(AppDbContext dbContext) : IEvaluator
{
    public async Task<UserVariation> EvaluateAsync(FeatureFlag flag, EndUser user)
    {
        // if flag is disabled
        if (!flag.IsEnabled)
        {
            return new UserVariation(flag.GetVariation(flag.DisabledVariationId), "flag disabled");
        }

        // if user is targeted
        var targetUser = flag.TargetUsers.FirstOrDefault(x => x.KeyIds.Contains(user.KeyId));
        if (targetUser != null)
        {
            return new UserVariation(flag.GetVariation(targetUser.VariationId), "targeted");
        }

        var flagKey = flag.Key;
        string dispatchKey;

        // if user is rule matched
        foreach (var rule in flag.Rules)
        {
            if (await IsMatchAsync(rule, user))
            {
                var ruleDispatchKey = rule.DispatchKey;
                dispatchKey = string.IsNullOrWhiteSpace(ruleDispatchKey)
                    ? $"{flagKey}{user.KeyId}"
                    : $"{flagKey}{user.ValueOf(ruleDispatchKey)}";

                var rolloutVariation = rule.Variations.FirstOrDefault(x => x.IsInRollout(dispatchKey))!;
                return new UserVariation(flag.GetVariation(rolloutVariation.Id), rule.Name);
            }
        }

        // match default rule
        var fallthroughDispatchKey = flag.Fallthrough.DispatchKey;
        dispatchKey = string.IsNullOrWhiteSpace(fallthroughDispatchKey)
            ? $"{flagKey}{user.KeyId}"
            : $"{flagKey}{user.ValueOf(fallthroughDispatchKey)}";

        var defaultVariation =
            flag.Fallthrough.Variations.FirstOrDefault(x => x.IsInRollout(dispatchKey))!;
        return new UserVariation(flag.GetVariation(defaultVariation.Id), "default");
    }

    private async Task<bool> IsMatchAsync(TargetRule rule, EndUser user)
    {
        foreach (var condition in rule.Conditions)
        {
            // in segment condition
            if (condition.Property is SegmentConsts.IsInSegment)
            {
                if (!await IsMatchAnySegmentAsync(condition, user))
                {
                    return false;
                }
            }
            // not in segment condition
            else if (condition.Property is SegmentConsts.IsNotInSegment)
            {
                if (await IsMatchAnySegmentAsync(condition, user))
                {
                    return false;
                }
            }
            // common condition
            else if (!condition.IsMatch(user))
            {
                return false;
            }
        }

        return true;
    }

    private async Task<bool> IsMatchAnySegmentAsync(Condition condition, EndUser user)
    {
        var segmentIds = JsonSerializer.Deserialize<string[]>(condition.Value);
        if (segmentIds == null || segmentIds.Length == 0)
        {
            return false;
        }

        var segments = dbContext.Set<Segment>().AsQueryable();
        foreach (var segmentId in segmentIds)
        {
            var segment = await segments.FirstOrDefaultAsync(x => x.Id == new Guid(segmentId));
            if (segment == null)
            {
                continue;
            }

            if (segment.IsMatch(user))
            {
                return true;
            }
        }

        return false;
    }
}