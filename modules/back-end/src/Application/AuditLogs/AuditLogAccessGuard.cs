using Application.Bases.Exceptions;
using Domain.AuditLogs;
using Domain.Policies;
using Domain.Resources;

namespace Application.AuditLogs;

public class AuditLogAccessGuard(IEnvironmentService envService)
{
    public async Task EnsureQueryAllowedAsync(QueryAuditLogs request)
    {
        var filter = request.Filter;
        string[] allowedRefTypes = filter.Scope switch
        {
            AuditLogScopes.Environment => [AuditLogRefTypes.FeatureFlag, AuditLogRefTypes.Segment],
            AuditLogScopes.Organization => [AuditLogRefTypes.Member, AuditLogRefTypes.Group, AuditLogRefTypes.Policy],
            _ => throw new ForbiddenException()
        };

        if (filter.RefTypes.Any(type => !allowedRefTypes.Contains(type)))
        {
            throw new ForbiddenException();
        }

        switch (filter.Scope)
        {
            case AuditLogScopes.Environment:
                await CheckEnvironmentAccess();
                break;
            case AuditLogScopes.Organization:
                CheckOrganizationAccess();
                break;
            default:
                throw new ForbiddenException();
        }

        return;

        async Task CheckEnvironmentAccess()
        {
            var environment = await envService.GetResourceDescriptorAsync(filter.ScopeId);
            if (environment == null || environment.Organization.Id != request.OrganizationId)
            {
                throw new ForbiddenException();
            }

            var environmentRn = RN.ForEnv(environment.Project.Key, environment.Environment.Key);
            if (!PolicyHelper.IsAllowed(request.Permissions, environmentRn, Permissions.CanAccessEnv))
            {
                throw new ForbiddenException();
            }
        }

        void CheckOrganizationAccess()
        {
            var scopeMatch = filter.ScopeId == request.OrganizationId;
            // Organization-level audit logs currently only cover IAM operations, so reuse CanManageIAM
            // until audit log read permissions are defined for additional operation types.
            var canManageIam =
                PolicyHelper.IsAllowed(request.Permissions, RN.ForIam(), Permissions.CanManageIAM);

            if (!scopeMatch || !canManageIam)
            {
                throw new ForbiddenException();
            }
        }
    }
}
