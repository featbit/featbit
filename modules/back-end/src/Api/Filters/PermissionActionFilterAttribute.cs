using System.Text.RegularExpressions;
using Domain.Policies;
using Domain.Resources;
using Microsoft.AspNetCore.Mvc.Filters;

namespace Api.Filters;

public class ResourceNameTuple
{
    public string Type { get; set; }

    public string ToResourceName()
    {
        return $"{Type}/*";
    }
}

public class PermissionActionFilterAttribute : ActionFilterAttribute
{
    private readonly string _action;
    private readonly IEnumerable<ResourceNameTuple> _resourceNames;
    
    public PermissionActionFilterAttribute(IEnumerable<ResourceNameTuple> resourceNames, string action) =>
        (_resourceNames, _action) = (resourceNames, action);
    
    public override void OnActionExecuting(ActionExecutingContext context)
    {
        var permissions = new List<PolicyStatement>(); // Use real one
        var resourceName = string.Join(":", _resourceNames.Select(rn => rn.ToResourceName()));
        
        if (!CanTakeAction(resourceName, _action, permissions))
        {
            context.Result = new ForbidResult();
            return;
        }

        base.OnActionExecuting(context);
    }

    private bool CanTakeAction(string resourceName, string action, IEnumerable<PolicyStatement> permissions)
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

            return matchingResource != null && permission.Actions.FirstOrDefault(act => act == action) != null;
        });

        if (matchingPermissions.FirstOrDefault(permission => permission.Effect == EffectType.Deny) != null)
        {
            return false;
        }

        var matchingAction = matchingPermissions.FirstOrDefault(permission =>
        {
            return permission.Effect != EffectType.Deny &&
                   permission.Actions.FirstOrDefault(act => act == "*" || act == action) != null;

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