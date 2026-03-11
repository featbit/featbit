using Application.Resources;
using Domain.FeatureFlags;
using Domain.Organizations;
using Domain.Projects;
using Domain.Resources;
using MongoDB.Driver;
using MongoDB.Driver.Linq;
using Environment = Domain.Environments.Environment;

namespace Infrastructure.Services.MongoDb;

public class ResourceService(MongoDbClient mongoDb) : IResourceService
{
    private IMongoQueryable<TEntity> QueryableOf<TEntity>() where TEntity : class => mongoDb.QueryableOf<TEntity>();

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

    public Task<string> GetProjectRnAsync(Guid projectId)
    {
        return QueryableOf<Project>()
            .Where(project => project.Id == projectId)
            .Select(project => "projects/" + project.Key)
            .FirstOrDefaultAsync();
    }

    public Task<string> GetEnvRnAsync(Guid envId)
    {
        var query =
            from env in QueryableOf<Environment>()
            join project in QueryableOf<Project>() on env.ProjectId equals project.Id
            where env.Id == envId
            select "project/" + project.Key + ":env/" + env.Key;

        return query.FirstOrDefaultAsync();
    }

    public async Task<string?> GetFlagRnAsync(Guid envId, string key)
    {
        var query =
            from project in QueryableOf<Project>()
            join env in QueryableOf<Environment>() on project.Id equals env.ProjectId
            join flag in QueryableOf<FeatureFlag>() on env.Id equals flag.EnvId
            where flag.EnvId == envId && flag.Key == key
            select new
            {
                projectKey = project.Key,
                envKey = env.Key,
                flagKey = flag.Key,
                flagTags = flag.Tags
            };

        var data = await query.FirstOrDefaultAsync();
        return data == null
            ? null
            : $"project/{data.projectKey}:env/{data.envKey}:flag/{data.flagKey};{string.Join(",", data.flagTags)}";
    }

    private async Task<IEnumerable<Resource>> GetProjectsAsync(Guid organizationId, string name)
    {
        var query = QueryableOf<Project>()
            .Where(project => project.OrganizationId == organizationId)
            .Select(project => new
            {
                project.Id,
                project.Name,
                Rn = "project/" + project.Key
            });
        if (!string.IsNullOrWhiteSpace(name))
        {
            query = query.Where(x => x.Name.Contains(name, StringComparison.CurrentCultureIgnoreCase));
        }

        var items = await query.ToListAsync();

        var resources = items.Select(x => new Resource
        {
            Id = x.Id,
            Name = x.Name,
            Rn = x.Rn,
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
                Rn = "project/" + project.Key + ":env/" + env.Key
            };

        if (!string.IsNullOrWhiteSpace(name))
        {
            query = query.Where(x => x.Name.Contains(name, StringComparison.CurrentCultureIgnoreCase));
        }

        var items = await query.ToListAsync();

        var resources = items.Select(x => new Resource
        {
            Id = x.Id,
            Name = x.Name,
            Rn = x.Rn,
            Type = ResourceTypes.Env
        }).ToList();

        resources.Insert(0, Resource.AllProjectEnv);
        return resources;
    }
}