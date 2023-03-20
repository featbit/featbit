using Domain.Policies;

namespace Api.Authorization;

public interface IPermissionChecker
{
    bool IsGranted(IEnumerable<PolicyStatement> statements, PermissionRequirement requirement);
}