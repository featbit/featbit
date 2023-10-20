using MongoDB.Driver;

namespace Infrastructure.MongoDb;

public interface IMongoDbClient
{
    IMongoDatabase Database { get; }
}