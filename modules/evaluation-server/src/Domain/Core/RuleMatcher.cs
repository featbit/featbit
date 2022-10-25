using System.Text.Json;
using Domain.EndUsers;

namespace Domain.Core;

public class RuleMatcher
{
    public static bool IsMatchSegment(byte[] segment, EndUser user)
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

    public static bool IsMatchCondition(JsonElement condition, EndUser user)
    {
        var property = condition.GetProperty("property").GetString()!;
        var op = condition.GetProperty("op").GetString()!;
        var conditionValue = condition.GetProperty("value").GetString()!;

        var userValue = user.ValueOf(property);

        var theOperator = Operator.Get(op);
        return theOperator.IsMatch(userValue, conditionValue);
    }
}