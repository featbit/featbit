using Domain.Policies;

namespace Api.Authorization;

public interface IPermissionChecker
{
    bool IsGranted(AuthorizationHandlerContext context, IEnumerable<PolicyStatement> statements, PermissionRequirement requirement);
}