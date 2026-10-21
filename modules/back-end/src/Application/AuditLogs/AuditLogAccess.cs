using Application.Bases.Exceptions;
using Application.Services;
using Domain.Policies;
using Domain.Resources;

namespace Application.AuditLogs;

public class AuditLogAccess : IAuditLogAccess
{
    public Task EnsureAsync(AuditLogFilter filter, PolicyStatement[] permissions)
    {
        if (filter.Scope == AuditLogScope.Iam &&
            !PolicyHelper.IsAllowed(permissions, RN.ForIam(), Permissions.CanManageIAM))
            throw new ForbiddenException();

        return Task.CompletedTask;
    }
}
