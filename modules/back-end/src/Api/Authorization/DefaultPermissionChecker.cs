using Domain.Policies;
using Domain.Resources;

namespace Api.Authorization;

public class DefaultPermissionChecker : IPermissionChecker
{
    private readonly ILogger<DefaultPermissionChecker> _logger;

    public DefaultPermissionChecker(ILogger<DefaultPermissionChecker> logger)
    {
        _logger = logger;
    }

    public bool IsGranted(IEnumerable<PolicyStatement> statements, PermissionRequirement requirement)
    {
        var permission = requirement.PermissionName;

        // get resource type
        if (!Permissions.ResourceMap.TryGetValue(permission, out var resourceType))
        {
            _logger.LogWarning("The permission '{Permission}' has no corresponding resourceType.", permission);
            return false;
        }

        var rn = ResourceHelper.GetRn(resourceType);

        // get matched statements
        var matchedStatements = statements.Where(statement =>
        {
            if (statement.ResourceType == ResourceTypes.All)
            {
                return true;
            }

            return statement.Resources.Any(pattern => ResourceHelper.IsRnMatchPattern(rn, pattern)) &&
                   statement.Actions.Any(act => act == "*" || act == permission);
        }).ToArray();

        // no matched statements
        if (!matchedStatements.Any())
        {
            return false;
        }

        return matchedStatements.All(x => x.Effect == EffectType.Allow);
    }
}