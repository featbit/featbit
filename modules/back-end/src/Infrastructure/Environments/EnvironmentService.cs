using Domain.Environments;
using MongoDB.Driver;
using MongoDB.Driver.Linq;
using Environment = Domain.Environments.Environment;

namespace Infrastructure.Environments;

public class EnvironmentService : MongoDbService<Environment>, IEnvironmentService
{
    public EnvironmentService(MongoDbClient mongoDb) : base(mongoDb)
    {
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
        return await Queryable.AnyAsync(environment =>
            environment.ProjectId == projectId &&
            string.Equals(environment.Key, key, StringComparison.OrdinalIgnoreCase)
        );
    }
}