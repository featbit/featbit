using Application.Resources;
using Domain.Organizations;
using Domain.Projects;
using Domain.Resources;
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
            ResourceTypes.All => new[] { Resource.All },
            ResourceTypes.Organization => new[] { Resource.AllOrganizations },
            ResourceTypes.Iam => new[] { Resource.AllIam },
            ResourceTypes.AccessToken => new[] { Resource.AllAccessToken },
            ResourceTypes.RelayProxy => new[] { Resource.AllRelayProxies },
            ResourceTypes.FeatureFlag => new[] { Resource.AllFeatureFlag },
            ResourceTypes.Segment => new[] { Resource.AllSegments },
            ResourceTypes.Env => await GetEnvsAsync(organizationId, name),
            ResourceTypes.Project => await GetProjectsAsync(organizationId, name),
            _ => Array.Empty<Resource>()
        };
    }

    public async Task<IEnumerable<Resource>> GetProjectsAsync(Guid organizationId, string name)
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
            query = query.Where(x => x.Name.ToLower().Contains(name.ToLower()));
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

    public async Task<IEnumerable<Resource>> GetEnvsAsync(Guid organizationId, string name)
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
            query = query.Where(x => x.Name.ToLower().Contains(name.ToLower()));
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