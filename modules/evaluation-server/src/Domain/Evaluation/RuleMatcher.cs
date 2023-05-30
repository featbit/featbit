using System.Text.Json;
using Domain.EndUsers;
using Domain.Shared;

namespace Domain.Evaluation;

public class RuleMatcher : IRuleMatcher
{
    private readonly IStore _store;

    public RuleMatcher(IStore store)
    {
        _store = store;
    }

    public async ValueTask<bool> IsMatchAsync(JsonElement rule, EndUser user)
    {
        var conditions = rule.GetProperty("conditions");
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
            else if (!IsMatchCondition(condition, user))
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
            var segment = await _store.GetSegmentAsync(segmentId);
            if (IsMatchSegment(segment, user))
            {
                return true;
            }
        }

        return false;
    }

    private static bool IsMatchSegment(byte[] segment, EndUser user)
    {
        using var document = JsonDocument.Parse(segment);
        var root = document.RootElement;

        var excludes = root.GetProperty("excluded").EnumerateArray();
        foreach (var exclude in excludes)
        {
            if (exclude.GetString() == user.KeyId)
            {
                return false;
            }
        }

        var includes = root.GetProperty("included").EnumerateArray();
        foreach (var include in includes)
        {
            if (include.GetString() == user.KeyId)
            {
                return true;
            }
        }

        var rules = root.GetProperty("rules").EnumerateArray();
        foreach (var rule in rules)
        {
            if (IsMatchRule(rule, user))
            {
                return true;
            }
        }

        return false;

        bool IsMatchRule(JsonElement segmentMatchRule, EndUser endUser)
        {
            var conditions = segmentMatchRule.GetProperty("conditions").EnumerateArray();
            foreach (var condition in conditions)
            {
                if (!IsMatchCondition(condition, endUser))
                {
                    return false;
                }
            }

            return true;
        }
    }

    private static bool IsMatchCondition(JsonElement condition, EndUser user)
    {
        var property = condition.GetProperty("property").GetString()!;
        var op = condition.GetProperty("op").GetString()!;
        var conditionValue = condition.GetProperty("value").GetString()!;

        var userValue = user.ValueOf(property);

        var theOperator = Operator.Get(op);
        return theOperator.IsMatch(userValue, conditionValue);
    }
}