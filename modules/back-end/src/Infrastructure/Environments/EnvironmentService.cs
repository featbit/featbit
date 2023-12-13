using Domain.Environments;
using Domain.Organizations;
using Domain.Projects;
using MongoDB.Driver;
using MongoDB.Driver.Linq;
using Environment = Domain.Environments.Environment;

namespace Infrastructure.Environments;

public class EnvironmentService : MongoDbService<Environment>, IEnvironmentService
{
    public EnvironmentService(MongoDbClient mongoDb) : base(mongoDb)
    {
    }

    public async Task<ResourceDescriptor> GetResourceDescriptorAsync(Guid envId)
    {
        var organizations = MongoDb.QueryableOf<Organization>();
        var projects = MongoDb.QueryableOf<Project>();
        var environments = MongoDb.QueryableOf<Environment>();

        var query = from environment in environments
            join project in projects on environment.ProjectId equals project.Id
            join organization in organizations on project.OrganizationId equals organization.Id
            where environment.Id == envId
            select new ResourceDescriptor
            {
                Organization = new IdNameProps
                {
                    Id = organization.Id,
                    Name = organization.Name
                },
                Project = new IdNameProps
                {
                    Id = project.Id,
                    Name = project.Name
                },
                Environment = new IdNameProps
                {
                    Id = environment.Id,
                    Name = environment.Name
                }
            };

        var descriptor = await query.FirstOrDefaultAsync();
        return descriptor;
    }

    public async Task DeleteAsync(Guid id)
    {
        await MongoDb.CollectionOf<Environment>().DeleteOneAsync(x => x.Id == id);
    }

    public async Task<IEnumerable<Setting>> GetSettingsAsync(Guid envId, string type)
    {
        var environment = await GetAsync(envId);

        return environment.Settings.Where(x => x.Type == type);
    }

    public async Task<bool> HasKeyBeenUsedAsync(Guid projectId, string key)
    {
        return await AnyAsync(environment =>
            environment.ProjectId == projectId &&
            string.Equals(environment.Key, key, StringComparison.OrdinalIgnoreCase)
        );
    }
}