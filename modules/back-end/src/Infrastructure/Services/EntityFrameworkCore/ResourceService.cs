using Application.Resources;
using Domain.FeatureFlags;
using Domain.Organizations;
using Domain.Projects;
using Domain.Resources;
using Domain.Segments;
using Microsoft.EntityFrameworkCore;
using Environment = Domain.Environments.Environment;

namespace Infrastructure.Services.EntityFrameworkCore;

public class ResourceService(AppDbContext dbContext) : IResourceService
{
    private IQueryable<TEntity> QueryableOf<TEntity>() where TEntity : class => dbContext.Set<TEntity>().AsQueryable();

    public async Task<IEnumerable<Resource>> GetResourcesAsync(Guid organizationId, ResourceFilter filter)
    {
        var name = filter.Name;

        return filter.Type switch
        {
            ResourceTypes.All => [Resource.All],
            ResourceTypes.Workspace => [Resource.AllWorkspace],
            ResourceTypes.Organization => [Resource.AllOrganizations],
            ResourceTypes.Iam => [Resource.AllIam],
            ResourceTypes.AccessToken => [Resource.AllAccessToken],
            ResourceTypes.RelayProxy => [Resource.AllRelayProxies],
            ResourceTypes.FeatureFlag => [Resource.AllFeatureFlag],
            ResourceTypes.Segment => [Resource.AllSegments],
            ResourceTypes.Env => await GetEnvsAsync(organizationId, name),
            ResourceTypes.Project => await GetProjectsAsync(organizationId, name),
            _ => []
        };
    }

    public async Task<ResourceRn?> GetProjectRnAsync(Guid projectId)
    {
        var project = await QueryableOf<Project>()
            .Where(x => x.Id == projectId)
            .Select(x => new { x.Key, x.OrganizationId })
            .FirstOrDefaultAsync();

        return project == null || string.IsNullOrWhiteSpace(project.Key)
            ? null : new ResourceRn(RN.ForProject(project.Key), project.OrganizationId);
    }

    public async Task<ResourceRn?> GetEnvRnAsync(Guid envId)
    {
        var query =
            from env in QueryableOf<Environment>()
            join project in QueryableOf<Project>() on env.ProjectId equals project.Id
            where env.Id == envId
            select new { project.Key, EnvKey = env.Key, project.OrganizationId };

        var data = await query.FirstOrDefaultAsync();
        return data == null ? null : new ResourceRn(RN.ForEnv(data.Key, data.EnvKey), data.OrganizationId);
    }

    public async Task<ResourceRn?> GetFlagRnAsync(Guid envId, string key)
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
        return data == null ? null : new ResourceRn(
            RN.ForFlag(data.projectKey, data.envKey, data.flagKey, data.flagTags), data.organizationId);
    }

    public async Task<ResourceRn?> GetSegmentRnAsync(Guid envId, Guid id)
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
                    : new ResourceRn(RN.ForSegment(projectEnv.ProjectKey, projectEnv.EnvKey, segment.Key, segment.Tags),
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
                    return new ResourceRn(
                        RN.ForSegment(projectEnv.ProjectKey, projectEnv.EnvKey, segment.Key, segment.Tags),
                        projectEnv.OrganizationId);
                }

                return null;
            }

            default:
                return null;
        }
    }

    private async Task<IEnumerable<Resource>> GetProjectsAsync(Guid organizationId, string name)
    {
        var query = QueryableOf<Project>()
            .Where(project => project.OrganizationId == organizationId)
            .Select(project => new
            {
                project.Id,
                project.Name,
                project.Key
            });
        if (!string.IsNullOrWhiteSpace(name))
        {
            query = query.Where(x => x.Name.ToLower().Contains(name.ToLower()));
        }

        var items = await query.ToListAsync();

        var resources = items.Select(x => new Resource
        {
            Id = x.Id,
            Name = x.Name,
            Rn = RN.ForProject(x.Key),
            Type = ResourceTypes.Project
        }).ToList();

        resources.Insert(0, Resource.AllProject);
        return resources;
    }

    private async Task<IEnumerable<Resource>> GetEnvsAsync(Guid organizationId, string name)
    {
        var organizations = QueryableOf<Organization>();
        var projects = QueryableOf<Project>();
        var envs = QueryableOf<Environment>();

        var query =
            from env in envs
            join project in projects on env.ProjectId equals project.Id
            join organization in organizations on project.OrganizationId equals organization.Id
            where organization.Id == organizationId
            select new
            {
                env.Id,
                env.Name,
                projectKey = project.Key,
                envKey = env.Key
            };

        if (!string.IsNullOrWhiteSpace(name))
        {
            query = query.Where(x => x.Name.ToLower().Contains(name.ToLower()));
        }

        var items = await query.ToListAsync();

        var resources = items.Select(x => new Resource
        {
            Id = x.Id,
            Name = x.Name,
            Rn = RN.ForEnv(x.projectKey, x.envKey),
            Type = ResourceTypes.Env
        }).ToList();

        resources.Insert(0, Resource.AllProjectEnv);
        return resources;
    }
}
