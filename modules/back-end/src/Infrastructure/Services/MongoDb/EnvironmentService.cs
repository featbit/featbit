using Domain.EndUsers;
using Domain.Environments;
using Domain.Organizations;
using Domain.Projects;
using MongoDB.Driver;
using MongoDB.Driver.Linq;
using Environment = Domain.Environments.Environment;

namespace Infrastructure.Services.MongoDb;

public class EnvironmentService(MongoDbClient mongoDb) : MongoDbService<Environment>(mongoDb), IEnvironmentService
{
    public async Task<string[]> GetServesAsync(string[] scopes)
    {
        if (scopes.Length == 0)
        {
            return [];
        }

        var projects = MongoDb.QueryableOf<Project>();
        var environments = MongoDb.QueryableOf<Environment>();

        var envIds = scopes.Select(Guid.Parse).ToArray();
        var query =
            from environment in environments
            join project in projects on environment.ProjectId equals project.Id
            where envIds.Contains(environment.Id)
            select new
            {
                envId = environment.Id,
                projectName = project.Name,
                envName = environment.Name
            };

        var result = await query.ToListAsync();
        return result
            .Select(x => $"{x.envId},{x.projectName}/{x.envName}")
            .ToArray();
    }

    public async Task<RpSecret[]> GetRpSecretsAsync(Guid[] envIds)
    {
        if (envIds.Length == 0)
        {
            return [];
        }

        var projects = MongoDb.QueryableOf<Project>();
        var environments = MongoDb.QueryableOf<Environment>();

        var query = from environment in environments
            join project in projects on environment.ProjectId equals project.Id
            where envIds.Contains(environment.Id)
            select new
            {
                EnvId = environment.Id,
                EnvKey = environment.Key,
                ProjectKey = project.Key,
                Secrets = environment.Secrets,
            };

        var result = await query.ToListAsync();

        var rpSecrets = result.Select(x => x.Secrets.Select(secret => new RpSecret
            {
                EnvId = x.EnvId,
                EnvKey = x.EnvKey,
                ProjectKey = x.ProjectKey,
                Type = secret.Type,
                Value = secret.Value
            }))
            .SelectMany(x => x)
            .ToArray();

        return rpSecrets;
    }

    public async Task<ResourceDescriptor?> GetResourceDescriptorAsync(Guid envId)
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
                    Key = organization.Key
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

        // add end-user built-in properties
        var builtInProperties = EndUserConsts.BuiltInUserProperties(env.Id);
        await MongoDb.CollectionOf<EndUserProperty>().InsertManyAsync(builtInProperties);
    }

    public async Task AddManyWithBuiltInPropsAsync(ICollection<Environment> envs)
    {
        await Collection.InsertManyAsync(envs);

        // add end-user built-in properties
        var builtInProperties = envs.SelectMany(x => EndUserConsts.BuiltInUserProperties(x.Id));
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
        await MongoDb.CollectionOf("Events").DeleteManyAsync(x => x["env_id"].AsGuid == id);
    }

    public async Task DeleteManyAsync(ICollection<Guid> ids)
    {
        await Collection.DeleteManyAsync(x => ids.Contains(x.Id));

        // delete end users
        await MongoDb.CollectionOf<EndUser>().DeleteManyAsync(x => x.EnvId != null && ids.Contains(x.EnvId.Value));

        // delete end user properties
        await MongoDb.CollectionOf<EndUserProperty>().DeleteManyAsync(x => ids.Contains(x.EnvId));

        // delete environment events
        await MongoDb.CollectionOf("Events").DeleteManyAsync(x => ids.Contains(x["env_id"].AsGuid));
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