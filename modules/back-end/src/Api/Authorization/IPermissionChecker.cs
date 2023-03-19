using Domain.Policies;

namespace Api.Authorization;

public interface IPermissionChecker
{
    Task<bool> IsGrantedAsync(IEnumerable<PolicyStatement> statements, string permissionName);
}