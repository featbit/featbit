namespace Api.Authorization;

public interface IPermissionChecker
{
    Task<bool> IsGrantedAsync(HttpContext httpContext, PermissionRequirement requirement);
}