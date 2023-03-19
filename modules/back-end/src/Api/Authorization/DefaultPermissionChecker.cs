using System.Security.Claims;
using System.Text.RegularExpressions;
using Application.Services;
using Domain.Policies;
using Domain.Resources;

namespace Api.Authorization;

public class DefaultPermissionChecker : IPermissionChecker
{
    private readonly IMemberService _memberService;

    public DefaultPermissionChecker(IMemberService memberService)
    {
        _memberService = memberService;
    }

    public async Task<bool> IsGrantedAsync(ClaimsPrincipal claimsPrincipal, string permissionName)
    {
        // TODO: check permission here
        return await Task.FromResult(true);
    }

    private static bool CanTakeAction(
        string rn,
        PermissionDefinition permissionDefinition,
        IEnumerable<PolicyStatement> userPermissions)
    {
        var matchedPermissions = userPermissions.Where(permission =>
        {
            if (permission.ResourceType == ResourceType.All)
            {
                return true;
            }

            return permission.Resources.Any(pattern => MatchPattern(rn, pattern)) &&
                   permission.Actions.Any(act => act == "*" || act == permissionDefinition.Name);
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