using Dapper;
using Domain.EndUsers;
using Domain.Environments;
using Domain.Organizations;
using Domain.Projects;
using Microsoft.EntityFrameworkCore;
using Environment = Domain.Environments.Environment;

namespace Infrastructure.Services.EntityFrameworkCore;

public class EnvironmentService(AppDbContext dbContext)
    : EntityFrameworkCoreService<Environment>(dbContext), IEnvironmentService
{
    public async Task<string[]> GetServesAsync(string[] scopes)
    {
        if (scopes.Length == 0)
        {
            return [];
        }

        var projects = QueryableOf<Project>();
        var environments = QueryableOf<Environment>();

        var envIds = scopes.Select(Guid.Parse).ToArray();
        var query =
            from environment in environments
            join project in projects on environment.ProjectId equals project.Id
            where envIds.Contains(environment.Id)
            select $"{environment.Id},{project.Name}/{environment.Name}";

        return await query.ToArrayAsync();
    }

    public async Task<RpSecret[]> GetRpSecretsAsync(Guid[] envIds)
    {
        if (envIds.Length == 0)
        {
            return [];
        }

        var projects = QueryableOf<Project>();
        var environments = QueryableOf<Environment>();

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
        var organizations = QueryableOf<Organization>();
        var projects = QueryableOf<Project>();
        var environments = QueryableOf<Environment>();

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
        Set.Add(env);

        // add end-user built-in properties
        var builtInProperties = EndUserConsts.BuiltInUserProperties(env.Id);
        SetOf<EndUserProperty>().AddRange(builtInProperties);

        await SaveChangesAsync();
    }

    public async Task AddManyWithBuiltInPropsAsync(ICollection<Environment> envs)
    {
        Set.AddRange(envs);

        // add end-user built-in properties
        var builtInProperties = envs.SelectMany(x => EndUserConsts.BuiltInUserProperties(x.Id));
        SetOf<EndUserProperty>().AddRange(builtInProperties);

        await SaveChangesAsync();
    }

    public async Task DeleteAsync(Guid id)
    {
        await DeleteOneAsync(id);

        // delete end users
        await SetOf<EndUser>().Where(x => x.EnvId == id).ExecuteDeleteAsync();

        // delete end user properties
        await SetOf<EndUserProperty>().Where(x => x.EnvId == id).ExecuteDeleteAsync();

        // delete environment events
        await DbConnection.ExecuteAsync("DELETE FROM events WHERE env_id = @id", new { id });
    }

    public async Task DeleteManyAsync(ICollection<Guid> ids)
    {
        await Set.Where(x => ids.Contains(x.Id)).ExecuteDeleteAsync();

        // delete end users
        await SetOf<EndUser>().Where(x => x.EnvId != null && ids.Contains(x.EnvId.Value)).ExecuteDeleteAsync();

        // delete end user properties
        await SetOf<EndUserProperty>().Where(x => ids.Contains(x.EnvId)).ExecuteDeleteAsync();

        // delete environment events
        await DbConnection.ExecuteAsync("DELETE FROM events WHERE env_id = ANY(@ids)", new { ids });
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
            string.Equals(environment.Key.ToLower(), key.ToLower())
        );
    }
}