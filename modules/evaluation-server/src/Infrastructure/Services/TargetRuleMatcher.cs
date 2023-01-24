using System.Text.Json;
using Domain.Core;
using Domain.EndUsers;
using Infrastructure.Caches;

namespace Infrastructure.Services;

public class TargetRuleMatcher
{
    private readonly ICacheService _cacheService;

    public TargetRuleMatcher(ICacheService cacheService)
    {
        _cacheService = cacheService;
    }

    public async ValueTask<bool> IsMatchAsync(JsonElement targetRule, EndUser user)
    {
        var conditions = targetRule.GetProperty("conditions");
        foreach (var condition in conditions.EnumerateArray())
        {
            var property = condition.GetProperty("property").GetString();

            // in segment condition
            if (property is "User is in segment")
            {
                if (!await IsMatchAnySegmentAsync(condition, user))
                {
                    return false;
                }
            }
            // not in segment condition
            else if (property is "User is not in segment")
            {
                if (await IsMatchAnySegmentAsync(condition, user))
                {
                    return false;
                }
            }
            // common condition
            else if (!RuleMatcher.IsMatchCondition(condition, user))
            {
                return false;
            }
        }

        return true;
    }

    private async Task<bool> IsMatchAnySegmentAsync(JsonElement segmentCondition, EndUser user)
    {
        var value = segmentCondition.GetProperty("value").GetString()!;

        var segmentIds = JsonSerializer.Deserialize<string[]>(value);
        if (segmentIds == null || !segmentIds.Any())
        {
            return false;
        }

        foreach (var segmentId in segmentIds)
        {
            var segment = await _cacheService.GetSegmentAsync(segmentId);
            if (RuleMatcher.IsMatchSegment(segment, user))
            {
                return true;
            }
        }

        return false;
    }
}