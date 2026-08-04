using Domain.Resources;

namespace Domain.Policies;

public static class PolicyHelper
{
    public static bool IsMatch(PolicyStatement statement, string resourceRN, string permission)
    {
        if (statement.ResourceType == ResourceTypes.All)
        {
            return true;
        }

        return statement.Actions.Any(act => act == "*" || act == permission) &&
               statement.Resources.Any(pattern => RNMatcher.IsMatch(resourceRN, pattern));
    }

    public static bool IsAllowed(IEnumerable<PolicyStatement> statements, string resourceRN, string permission)
    {
        var matchedStatements = statements
            .Where(statement => IsMatch(statement, resourceRN, permission))
            .ToArray();

        // no matched statements
        if (matchedStatements.Length == 0)
        {
            return false;
        }

        return matchedStatements.All(x => x.Effect == EffectType.Allow);
    }
}
