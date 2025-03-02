using Application.Resources;
using Domain.Organizations;
using Domain.Projects;
using Domain.Resources;
using Domain.Workspaces;
using Microsoft.EntityFrameworkCore;
using Environment = Domain.Environments.Environment;

namespace Infrastructure.Services.EntityFrameworkCore;

public class ResourceServiceV2(AppDbContext dbContext) : IResourceServiceV2
{
    private IQueryable<TEntity> QueryableOf<TEntity>() where TEntity : class => dbContext.Set<TEntity>().AsQueryable();

    public async Task<string> GetRNAsync(Guid resourceId, string resourceType)
    {
        var rn = resourceType switch
        {
            ResourceTypes.Env => await GetEnvRnAsync(resourceId),
            _ => string.Empty
        };

        return rn;
    }

    public async Task<IEnumerable<ResourceV2>> GetResourcesAsync(Guid spaceId, ResourceFilterV2 filter)
    {
        var name = filter.Name;
        var spaceLevel = filter.SpaceLevel;

        var resources = new List<ResourceV2>();
        foreach (var type in filter.Types)
        {
            var items = type switch
            {
                ResourceTypes.Organization => await GetOrganizationsAsync(spaceId, spaceLevel, name),
                ResourceTypes.Env => await GetEnvsAsync(spaceId, spaceLevel, name),
                ResourceTypes.Project => await GetProjectsAsync(spaceId, spaceLevel, name),
                _ => Enumerable.Empty<ResourceV2>()
            };

            resources.AddRange(items);
        }

        return resources;
    }

    private async Task<IEnumerable<ResourceV2>> GetOrganizationsAsync(Guid spaceId, string spaceLevel, string name)
    {
        if (spaceLevel != ResourceSpaceLevel.Workspace)
        {
            return Enumerable.Empty<ResourceV2>();
        }

        var query = QueryableOf<Organization>()
            .Where(x => x.WorkspaceId == spaceId)
            .Select(x => new ResourceV2
            {
                Id = x.Id,
                Name = x.Name,
                PathName = x.Name,
                Rn = "organization/" + x.Key,
                Type = ResourceTypes.Organization
            });

        var items = await HandleQueryAsync(query, name, ResourceV2.AllOrganizations);
        return items;
    }

    private async Task<IEnumerable<ResourceV2>> GetProjectsAsync(Guid spaceId, string spaceLevel, string name)
    {
        var query = spaceLevel == ResourceSpaceLevel.Workspace
            ? GetWorkspaceProjectsQuery()
            : GetOrganizationProjectsQuery();

        var items = await HandleQueryAsync(query, name, ResourceV2.AllProject);
        return items;

        IQueryable<ResourceV2> GetWorkspaceProjectsQuery()
        {
            var workspaceLevelQuery =
                from workspace in QueryableOf<Workspace>()
                join organization in QueryableOf<Organization>() on workspace.Id equals organization.WorkspaceId
                join project in QueryableOf<Project>() on organization.Id equals project.OrganizationId
                where workspace.Id == spaceId
                select new ResourceV2
                {
                    Id = project.Id,
                    Name = project.Name,
                    PathName = organization.Name + "/" + project.Name,
                    Rn = "organization/" + organization.Key + ":project/" + project.Key,
                    Type = ResourceTypes.Project
                };

            return workspaceLevelQuery;
        }

        IQueryable<ResourceV2> GetOrganizationProjectsQuery()
        {
            var organizationLevelQuery =
                from organization in QueryableOf<Organization>()
                join project in QueryableOf<Project>() on organization.Id equals project.OrganizationId
                where organization.Id == spaceId
                select new ResourceV2
                {
                    Id = project.Id,
                    Name = project.Name,
                    PathName = project.Name,
                    Rn = "organization/" + organization.Key + ":project/" + project.Key,
                    Type = ResourceTypes.Project
                };

            return organizationLevelQuery;
        }
    }

    private async Task<IEnumerable<ResourceV2>> GetEnvsAsync(Guid spaceId, string spaceLevel, string name)
    {
        var query = spaceLevel == ResourceSpaceLevel.Workspace
            ? GetWorkspaceEnvsQuery()
            : GetOrganizationEnvsQuery();

        var items = await HandleQueryAsync(query, name, ResourceV2.AllProjectEnv);
        return items;

        IQueryable<ResourceV2> GetWorkspaceEnvsQuery()
        {
            var workspaceLevelQuery =
                from workspace in QueryableOf<Workspace>()
                join organization in QueryableOf<Organization>() on workspace.Id equals organization.WorkspaceId
                join project in QueryableOf<Project>() on organization.Id equals project.OrganizationId
                join env in QueryableOf<Environment>() on project.Id equals env.ProjectId
                where workspace.Id == spaceId
                select new ResourceV2
                {
                    Id = env.Id,
                    Name = env.Name,
                    PathName = organization.Name + "/" + project.Name + "/" + env.Name,
                    Rn = "organization/" + organization.Key + ":project/" + project.Key + ":env/" + env.Key,
                    Type = ResourceTypes.Env
                };

            return workspaceLevelQuery;
        }

        IQueryable<ResourceV2> GetOrganizationEnvsQuery()
        {
            var organizationLevelQuery =
                from organization in QueryableOf<Organization>()
                join project in QueryableOf<Project>() on organization.Id equals project.OrganizationId
                join env in QueryableOf<Environment>() on project.Id equals env.ProjectId
                where organization.Id == spaceId
                select new ResourceV2
                {
                    Id = env.Id,
                    Name = env.Name,
                    PathName = project.Name + "/" + env.Name,
                    Rn = "organization/" + organization.Key + ":project/" + project.Key + ":env/" + env.Key,
                    Type = ResourceTypes.Env
                };

            return organizationLevelQuery;
        }
    }

    private static async Task<IEnumerable<ResourceV2>> HandleQueryAsync(
        IQueryable<ResourceV2> query,
        string name,
        ResourceV2 allResource)
    {
        var hasNameFilter = !string.IsNullOrWhiteSpace(name);
        if (hasNameFilter)
        {
            query = query.Where(x => x.Name.ToLower().Contains(name.ToLower()));
        }

        var items = await query.ToListAsync();
        if (!hasNameFilter)
        {
            items.Insert(0, allResource);
        }

        return items;
    }

    private async Task<string> GetEnvRnAsync(Guid envId)
    {
        var query =
            from organization in QueryableOf<Organization>()
            join project in QueryableOf<Project>() on organization.Id equals project.OrganizationId
            join env in QueryableOf<Environment>() on project.Id equals env.ProjectId
            where env.Id == envId
            select new
            {
                Rn = "organization/" + organization.Key + ":project/" + project.Key + ":env/" + env.Key,
            };

        var resource = await query.FirstOrDefaultAsync();
        return resource?.Rn ?? string.Empty;
    }
}