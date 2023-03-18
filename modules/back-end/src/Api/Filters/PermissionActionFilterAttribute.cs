using System.Text.RegularExpressions;
using Api.Controllers;
using Application.Bases;
using Domain.Policies;
using Domain.Resources;
using Microsoft.AspNetCore.Mvc.Filters;

namespace Api.Filters;

public class PermissionActionFilterAttribute : ActionFilterAttribute
{
    private readonly string _permissionActionName;
    
    public PermissionActionFilterAttribute(string permissionActionName) =>
        _permissionActionName = permissionActionName;
    
    public override void OnActionExecuting(ActionExecutingContext context)
    {
        var permissions = new List<PolicyStatement>
        {
            new PolicyStatement
            {
                ResourceType = ResourceType.AccessToken,
                Effect = EffectType.Allow,
                Actions = new List<string> { PermissionActionName.ListAccessTokens, PermissionActionName.ManageServiceAccessTokens },
                Resources = new List<string> { "access-token/*" }
            }
        }; // Use real one
        
        var permissionAction = PermissionActions.GetPermissionActionByName(_permissionActionName);
        
        if (!CanTakeAction(permissionAction.GetResourceName(), permissionAction, permissions))
        {
            var response = ApiResponse<object>.Error(ErrorCodes.Forbidden);
            context.Result = new BadRequestObjectResult(response);
            return;
        }

        base.OnActionExecuting(context);
    }

    private bool CanTakeAction(string resourceName, PermissionAction action, IEnumerable<PolicyStatement> permissions)
    {
        var matchingPermissions = permissions.Where(permission =>
        {
            if (permission.ResourceType == ResourceType.All)
            {
                return permission.Effect == EffectType.Allow;
            }

            var matchingResource = permission.Resources.FirstOrDefault(resource =>
            {
                // check exact match
                if (MatchRule(resourceName, resource))
                {
                    return true;
                }

                // check ancestors matches following bottom up order
                var resourceNameParts = resourceName.Split(':');
                var reversedParts = resourceNameParts.Reverse();
                return reversedParts.Any(part =>
                {
                    resourceNameParts = resourceNameParts.SkipLast(1).ToArray();

                    return MatchRule(string.Join(":", resourceNameParts), resource);
                });
            });

            return matchingResource != null && permission.Actions.FirstOrDefault(act => act == action.Name) != null;
        });

        if (matchingPermissions.FirstOrDefault(permission => permission.Effect == EffectType.Deny) != null)
        {
            return false;
        }

        var matchingAction = matchingPermissions.FirstOrDefault(permission =>
        {
            return permission.Effect != EffectType.Deny &&
                   permission.Actions.FirstOrDefault(act => act == "*" || act == action.Name) != null;

        });

        return matchingAction != null;
    }
    
    private static bool MatchRule(string str, string rule)
    {
        string EscapeRegex(string s) => Regex.Replace(s, "([.*+?^=!:${}()|\\[\\]\\\\/])", "\\$1");

        var matchPattern = rule
            .Split('*')
            .Select(EscapeRegex)
            .Aggregate((x, y) => $"{x}.*{y}");

        var regex = new Regex($"^{matchPattern}$");
        return regex.IsMatch(str);
    }
}