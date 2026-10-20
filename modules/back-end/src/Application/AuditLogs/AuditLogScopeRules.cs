using Application.Bases.Exceptions;
using Domain.Policies;
using Domain.Resources;

namespace Application.AuditLogs;

internal static class AuditLogScopeRules
{
    public static async Task ValidateAsync(
        AuditLogFilter filter, Guid orgId, PolicyStatement[] permissions,
        IEnvironmentService environments, IProjectService projects)
    {
        switch (filter.Scope)
        {
            case AuditLogScope.Iam:
                if (!PolicyHelper.IsAllowed(permissions, RN.ForIam(), Permissions.CanManageIAM))
                    throw new ForbiddenException();
                return;
            case AuditLogScope.Environment:
                if (!filter.EnvId.HasValue) throw new ForbiddenException();
                var environment = await environments.GetAsync(filter.EnvId.Value);
                var project = environment == null ? null : await projects.GetAsync(environment.ProjectId);
                if (project?.OrganizationId != orgId) throw new ForbiddenException();
                return;
            default:
                throw new ForbiddenException();
        }
    }
}
