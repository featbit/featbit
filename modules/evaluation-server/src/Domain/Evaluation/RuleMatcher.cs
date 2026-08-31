using System.Text.Json;
using Domain.EndUsers;
using Domain.Shared;

namespace Domain.Evaluation;

public class RuleMatcher(IStore store) : IRuleMatcher
{
    public async ValueTask<bool> IsMatchAsync(JsonElement rule, EndUser user)
    {
        var reader = EntityJsonReader.FeatureFlag;

        var conditions = reader.GetRequiredArray(rule, "conditions");
        foreach (var condition in conditions.EnumerateArray())
        {
            var property = reader.GetRequiredString(condition, "property");

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
            else if (!IsMatchCondition(condition, user, reader))
            {
                return false;
            }
        }

        return true;
    }

    private async Task<bool> IsMatchAnySegmentAsync(JsonElement segmentCondition, EndUser user)
    {
        var reader = EntityJsonReader.FeatureFlag;

        var value = reader.GetRequiredString(segmentCondition, "value");

        var segmentIds = reader.DeserializeSegmentIds(value, "value");
        if (segmentIds.Length == 0)
        {
            return false;
        }

        foreach (var segmentId in segmentIds)
        {
            var segment = await store.GetSegmentAsync(segmentId);
            if (IsMatchSegment(segmentId, segment, user))
            {
                return true;
            }
        }

        return false;
    }

    private static bool IsMatchSegment(string segmentId, byte[] segment, EndUser user)
    {
        var reader = EntityJsonReader.ForSegment(segmentId);

        using var document = reader.Parse(segment);
        var root = document.RootElement;

        var excludes = reader.GetRequiredArray(root, "excluded").EnumerateArray();
        var excludeIndex = 0;
        foreach (var excludeElement in excludes)
        {
            var exclude = reader.GetRequiredStringValue(excludeElement, $"excluded[{excludeIndex++}]");
            if (exclude == user.KeyId)
            {
                return false;
            }
        }

        var includes = reader.GetRequiredArray(root, "included").EnumerateArray();
        var includeIndex = 0;
        foreach (var includeElement in includes)
        {
            var include = reader.GetRequiredStringValue(includeElement, $"included[{includeIndex++}]");
            if (include == user.KeyId)
            {
                return true;
            }
        }

        var rules = reader.GetRequiredArray(root, "rules").EnumerateArray();
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
            var conditions = reader.GetRequiredArray(segmentMatchRule, "conditions").EnumerateArray();
            foreach (var condition in conditions)
            {
                if (!IsMatchCondition(condition, endUser, reader))
                {
                    return false;
                }
            }

            return true;
        }
    }

    private static bool IsMatchCondition(JsonElement condition, EndUser user, EntityJsonReader reader)
    {
        var property = reader.GetRequiredString(condition, "property");
        var op = reader.GetRequiredString(condition, "op");
        var conditionValue = reader.GetRequiredString(condition, "value");

        try
        {
            var userValue = user.ValueOf(property);

            var theOperator = Operator.Get(op);
            return theOperator.IsMatch(userValue, conditionValue);
        }
        // Some operators parse the string value again using their own format. IsOneOf/NotOneOf can throw
        // JsonException for an invalid encoded string array, while regex operators can throw ArgumentException
        // for an invalid pattern. Treat both as malformed evaluation data for the current flag or segment.
        catch (Exception ex) when (ex is JsonException or ArgumentException)
        {
            throw reader.Malformed("Rule condition contains an invalid value", "conditions", ex);
        }
    }
}
