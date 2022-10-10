using Application.Resources;
using Application.Services;
using Domain.Organizations;
using Domain.Projects;
using Domain.Resources;
using MongoDB.Driver;
using MongoDB.Driver.Linq;
using Environment = Domain.Environments.Environment;

namespace Infrastructure.Resources;

public class ResourceService : IResourceService
{
    public MongoDbClient MongoDb { get; }

    public ResourceService(MongoDbClient mongoDb)
    {
        MongoDb = mongoDb;
    }

    public async Task<IEnumerable<Resource>> GetResourcesAsync(Guid organizationId, ResourceFilter filter)
    {
        var name = filter.Name;

        return filter.Type switch
        {
            ResourceType.All => GetAll(name),
            ResourceType.General => GetGeneral(name),
            ResourceType.Env => await GetEnvsAsync(organizationId, name),
            ResourceType.Project => await GetProjectsAsync(organizationId, name),
            _ => Array.Empty<Resource>()
        };
    }

    private IEnumerable<Resource> GetAll(string name)
    {
        var resources = new List<Resource>
        {
            new()
            {
                Id = new Guid("2bdcb290-2e1b-40d7-bdd1-697fb2193292"),
                Name = "All",
                Rn = "*"
            }
        };

        if (!string.IsNullOrWhiteSpace(name))
        {
            resources = resources.Where(x => x.Name.Contains(name, StringComparison.OrdinalIgnoreCase)).ToList();
        }

        return resources;
    }

    private IEnumerable<Resource> GetGeneral(string name)
    {
        var resources = new List<Resource>
        {
            new()
            {
                Id = new Guid("e394832e-bd98-43de-b174-e0c98e03d19d"),
                Name = "Account",
                Rn = "account"
            },
            new()
            {
                Id = new Guid("d8791bd2-ca85-4629-a439-1dce20764211"),
                Name = "IAM",
                Rn = "iam"
            },
            new()
            {
                Id = new Guid("150083da-e20f-4670-948c-b842cf8a91a4"),
                Name = "Project",
                Rn = "project"
            }
        };

        if (!string.IsNullOrWhiteSpace(name))
        {
            resources = resources.Where(x => x.Name.Contains(name, StringComparison.OrdinalIgnoreCase)).ToList();
        }

        return resources;
    }

    public async Task<IEnumerable<Resource>> GetProjectsAsync(Guid organizationId, string name)
    {
        var query = MongoDb.QueryableOf<Project>()
            .Where(project => project.OrganizationId == organizationId)
            .Select(project => new
            {
                project.Id,
                project.Name,
                Rn = "project/" + project.Name
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
            Rn = x.Rn
        });
        return resources;
    }

    public async Task<IEnumerable<Resource>> GetEnvsAsync(Guid organizationId, string name)
    {
        var organizations = MongoDb.QueryableOf<Organization>();
        var projects = MongoDb.QueryableOf<Project>();
        var envs = MongoDb.QueryableOf<Environment>();

        var query =
            from env in envs
            join project in projects on env.ProjectId equals project.Id
            join organization in organizations on project.OrganizationId equals organization.Id
            where organization.Id == organizationId
            select new
            {
                env.Id,
                env.Name,
                Rn = "project/" + project.Name + ":env/" + env.Name
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
            Rn = x.Rn
        });
        return resources;
    }
}