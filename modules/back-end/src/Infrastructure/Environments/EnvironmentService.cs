using Domain.EndUsers;
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
                Organization = new IdNameKeyProps
                {
                    Id = organization.Id,
                    Name = organization.Name,
                    // there is no organization key yet
                    Key = string.Empty
                },
                Project = new IdNameKeyProps
                {
                    Id = project.Id,
                    Name = project.Name,
                    Key = project.Key
                },
                Environment = new IdNameKeyProps
                {
                    Id = environment.Id,
                    Name = environment.Name,
                    Key = environment.Key
                }
            };

        var descriptor = await query.FirstOrDefaultAsync();
        return descriptor;
    }

    public async Task AddWithBuiltInPropsAsync(Environment env)
    {
        await Collection.InsertOneAsync(env);

        // add built-in properties
        var builtInProperties = EndUserConsts.BuiltInUserProperties(env.Id);
        await MongoDb.CollectionOf<EndUserProperty>().InsertManyAsync(builtInProperties);
    }

    public async Task DeleteAsync(Guid id)
    {
        await MongoDb.CollectionOf<Environment>().DeleteOneAsync(x => x.Id == id);

        // delete end users
        await MongoDb.CollectionOf<EndUser>().DeleteManyAsync(x => x.EnvId == id);

        // delete end user properties
        await MongoDb.CollectionOf<EndUserProperty>().DeleteManyAsync(x => x.EnvId == id);

        // delete environment events
        await MongoDb.CollectionOf("Events").DeleteManyAsync(x => x["env_id"] == id);
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