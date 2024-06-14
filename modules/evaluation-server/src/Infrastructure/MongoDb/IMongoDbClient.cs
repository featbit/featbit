using MongoDB.Driver;

namespace Infrastructure.MongoDb;

public interface IMongoDbClient
{
    Task<bool> IsHealthyAsync();

    IMongoDatabase Database { get; }
}