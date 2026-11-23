using Domain.FeatureFlags;
using Domain.Organizations;
using Domain.Projects;
using Domain.Resources;
using Domain.Segments;
using Microsoft.EntityFrameworkCore;
using Environment = Domain.Environments.Environment;

namespace Infrastructure.Services.EntityFrameworkCore;

public class PermissionTargetResolver(AppDbContext dbContext) : IPermissionTargetResolver
{
    private IQueryable<TEntity> QueryableOf<TEntity>() where TEntity : class => dbContext.Set<TEntity>().AsQueryable();

    public async Task<PermissionTarget?> ResolveProjectAsync(Guid projectId)
    {
        var project = await QueryableOf<Project>()
            .Where(x => x.Id == projectId)
            .Select(x => new { x.Key, x.OrganizationId })
            .FirstOrDefaultAsync();

        return project == null || string.IsNullOrWhiteSpace(project.Key)
            ? null : new PermissionTarget(RN.ForProject(project.Key), project.OrganizationId);
    }

    public async Task<PermissionTarget?> ResolveEnvironmentAsync(Guid envId)
    {
        var query =
            from env in QueryableOf<Environment>()
            join project in QueryableOf<Project>() on env.ProjectId equals project.Id
            where env.Id == envId
            select new { project.Key, EnvKey = env.Key, project.OrganizationId };

        var data = await query.FirstOrDefaultAsync();
        return data == null ? null : new PermissionTarget(RN.ForEnv(data.Key, data.EnvKey), data.OrganizationId);
    }

    public async Task<PermissionTarget?> ResolveFlagAsync(Guid envId, string key)
    {
        var query =
            from project in QueryableOf<Project>()
            join env in QueryableOf<Environment>() on project.Id equals env.ProjectId
            join flag in QueryableOf<FeatureFlag>() on env.Id equals flag.EnvId
            where flag.EnvId == envId && flag.Key == key
            select new
            {
                projectKey = project.Key,
                organizationId = project.OrganizationId,
                envKey = env.Key,
                flagKey = flag.Key,
                flagTags = flag.Tags
            };

        var data = await query.FirstOrDefaultAsync();
        return data == null ? null : new PermissionTarget(
            RN.ForFlag(data.projectKey, data.envKey, data.flagKey, data.flagTags), data.organizationId);
    }

    public async Task<PermissionTarget?> ResolveSegmentAsync(Guid envId, Guid id)
    {
        var segment = await QueryableOf<Segment>().FirstOrDefaultAsync(x => x.Id == id);
        if (segment == null)
        {
            return null;
        }

        switch (segment.Type)
        {
            case SegmentType.EnvironmentSpecific when segment.EnvId == envId:
            {
                var query =
                    from project in QueryableOf<Project>()
                    join env in QueryableOf<Environment>() on project.Id equals env.ProjectId
                    where env.Id == envId
                    select new
                    {
                        ProjectKey = project.Key,
                        project.OrganizationId,
                        EnvKey = env.Key
                    };

                var projectEnv = await query.FirstOrDefaultAsync();
                return projectEnv == null
                    ? null
                    : new PermissionTarget(RN.ForSegment(projectEnv.ProjectKey, projectEnv.EnvKey, segment.Key, segment.Tags),
                        projectEnv.OrganizationId);
            }

            case SegmentType.Shared:
            {
                var query = from env in QueryableOf<Environment>()
                    join project in QueryableOf<Project>() on env.ProjectId equals project.Id
                    join organization in QueryableOf<Organization>() on project.OrganizationId equals organization.Id
                    where env.Id == envId
                    select new
                    {
                        OrganizationKey = organization.Key,
                        ProjectKey = project.Key,
                        project.OrganizationId,
                        EnvKey = env.Key
                    };

                var projectEnv = await query.FirstOrDefaultAsync();
                if (projectEnv == null)
                {
                    return null;
                }

                var envScope =
                    $"organization/{projectEnv.OrganizationKey}:project/{projectEnv.ProjectKey}:env/{projectEnv.EnvKey}";
                if (segment.Scopes.Any(scope => RN.IsInScope(envScope, scope)))
                {
                    // Authorize the shared segment in the accessing environment's organization.
                    return new PermissionTarget(
                        RN.ForSegment(projectEnv.ProjectKey, projectEnv.EnvKey, segment.Key, segment.Tags),
                        projectEnv.OrganizationId);
                }

                return null;
            }

            default:
                return null;
        }
    }
}
