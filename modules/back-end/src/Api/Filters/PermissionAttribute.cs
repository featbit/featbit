using System.Text.RegularExpressions;
using Domain.Policies;
using Domain.Resources;
using Microsoft.AspNetCore.Mvc.Filters;

namespace Api.Filters;

// TODO: remove this
public class PermissionAttribute : ActionFilterAttribute
{
    private readonly string _action;

    public PermissionAttribute(string action)
    {
        _action = action;
    }

    public override void OnActionExecuting(ActionExecutingContext context)
    {
        var userPermissions = new List<PolicyStatement>
        {
            new()
            {
                ResourceType = ResourceType.AccessToken,
                Effect = EffectType.Allow,
                Actions = new[] { Actions.ListAccessTokens },
                Resources = new[] { "access-token/*" }
            }
        }; // Use real one

        var action = PermissionActions.GetPermissionActionByName(_action);

        var rn = action.GetRn();
        if (!CanTakeAction(rn, action, userPermissions))
        {
            context.Result = new ForbidResult();
            return;
        }

        base.OnActionExecuting(context);
    }

    private static bool CanTakeAction(string rn, PermissionAction action, IEnumerable<PolicyStatement> userPermissions)
    {
        var matchedPermissions = userPermissions.Where(permission =>
        {
            if (permission.ResourceType == ResourceType.All)
            {
                return true;
            }

            return permission.Resources.Any(pattern => MatchPattern(rn, pattern)) &&
                   permission.Actions.Any(act => act == "*" || act == action.Name);
        }).ToArray();

        // no matched permissions
        if (matchedPermissions.Length == 0)
        {
            return false;
        }

        return matchedPermissions.All(x => x.Effect == EffectType.Allow);
    }

    private static bool MatchPattern(string str, string rule)
    {
        string EscapeRegex(string s)
        {
            return Regex.Replace(s, "([.*+?^=!:${}()|\\[\\]\\\\/])", "\\$1");
        }

        var matchPattern = rule
            .Split('*')
            .Select(EscapeRegex)
            .Aggregate((x, y) => $"{x}.*{y}");

        var regex = new Regex($"^{matchPattern}$");
        return regex.IsMatch(str);
    }
}