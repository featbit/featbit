using Application.Services;
using Domain.AuditLogs;

namespace Infrastructure.Services;

public class AuditLogEnricher(
    IEnvironmentService environments, IProjectService projects, IOrganizationService organizations)
{
    public async Task<Guid> WorkspaceForEnvironmentAsync(Guid envId)
    {
        var env = await environments.GetAsync(envId);
        var project = await projects.GetAsync(env.ProjectId);
        return (await organizations.GetAsync(project.OrganizationId)).WorkspaceId;
    }

    public async Task EnrichAsync(AuditLog log)
    {
        if (log.EnvId.HasValue)
        {
            var env = await environments.GetAsync(log.EnvId.Value);
            var project = await projects.GetAsync(env.ProjectId);
            log.OrganizationId = project.OrganizationId;
        }
        if (log.OrganizationId.HasValue)
        {
            var org = await organizations.GetAsync(log.OrganizationId.Value);
            log.WorkspaceId = org.WorkspaceId;
        }
        if (log.WorkspaceId == Guid.Empty) throw new InvalidOperationException("Audit log requires a workspace.");
    }
}
