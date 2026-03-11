using Domain.Resources;

namespace Domain.Policies;

public static class PolicyHelper
{
    public static bool IsAllowed(IEnumerable<PolicyStatement> statements, string resourceRN, string permission)
    {
        // get matched statements
        var matchedStatements = statements.Where(statement =>
        {
            if (statement.ResourceType == ResourceTypes.All)
            {
                return true;
            }

            return statement.Resources.Any(pattern => RNMather.IsMatch(resourceRN, pattern)) &&
                   statement.Actions.Any(act => act == "*" || act == permission);
        }).ToArray();

        // no matched statements
        if (matchedStatements.Length == 0)
        {
            return false;
        }

        return matchedStatements.All(x => x.Effect == EffectType.Allow);
    }
}