using MongoDB.Driver;
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
}