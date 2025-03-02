using MongoDB.Driver;

namespace Infrastructure.Persistence.MongoDb;

public interface IMongoDbClient
{
    Task<bool> IsHealthyAsync();

    IMongoDatabase Database { get; }
}