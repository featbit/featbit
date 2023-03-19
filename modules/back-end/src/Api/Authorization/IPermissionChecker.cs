using System.Security.Claims;

namespace Api.Authorization;

public interface IPermissionChecker
{
    Task<bool> IsGrantedAsync(ClaimsPrincipal claimsPrincipal, string permissionName);
}