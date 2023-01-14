using System.Text.Json;
using Domain.EndUsers;
using Domain.FeatureFlags;
using Domain.Segments;
using Domain.Targeting;
using MongoDB.Driver.Linq;

namespace Infrastructure.Targeting;

public class Evaluator : IEvaluator
{
    private readonly MongoDbClient _mongoDb;

    public Evaluator(MongoDbClient mongoDb)
    {
        _mongoDb = mongoDb;
    }

    public async Task<UserVariation> EvaluateAsync(FeatureFlag flag, EndUser user)
    {
        // if flag is disabled
        if (!flag.IsEnabled)
        {
            return new UserVariation(flag.DisabledVariation, "flag disabled");
        }

        // if user is targeted
        var targetUser = flag.TargetUsers.FirstOrDefault(x => x.KeyIds.Contains(user.KeyId));
        if (targetUser != null)
        {
            return new UserVariation(flag.GetVariation(targetUser.VariationId), "targeted");
        }
        
        var splittingKeyName = string.Empty;
        // if user is rule matched
        foreach (var rule in flag.Rules)
        {
            if (await IsMatchAsync(rule, user))
            {
                splittingKeyName = string.IsNullOrWhiteSpace(rule.SplittingKey) ? "keyId" : rule.SplittingKey;
                var ruleSplittingKey = $"{user.ValueOf(splittingKeyName)}{flag.Key}";
                var rolloutVariation = rule.Variations.FirstOrDefault(x => x.IsInRollout(ruleSplittingKey))!;

                return new UserVariation(flag.GetVariation(rolloutVariation.Id), rule.Name);
            }
        }

        // match default rule
        splittingKeyName = string.IsNullOrWhiteSpace(flag.Fallthrough.SplittingKey) ? "keyId" : flag.Fallthrough.SplittingKey;
        var fallthroughSplittingKey = $"{user.ValueOf(splittingKeyName)}{flag.Key}";
        var defaultVariation =
            flag.Fallthrough.Variations.FirstOrDefault(x => x.IsInRollout(fallthroughSplittingKey))!;

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
        if (segmentIds == null || !segmentIds.Any())
        {
            return false;
        }

        var segments = _mongoDb.QueryableOf<Segment>();
        foreach (var segmentId in segmentIds)
        {
            var segment = await segments.FirstOrDefaultAsync(x => x.Id == new Guid(segmentId));
            if (segment.IsMatch(user))
            {
                return true;
            }
        }

        return false;
    }
}