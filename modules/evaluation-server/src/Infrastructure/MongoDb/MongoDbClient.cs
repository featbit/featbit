using Microsoft.Extensions.Options;
using MongoDB.Bson;
using MongoDB.Driver;
using MongoDB.Driver.Linq;

namespace Infrastructure.MongoDb;

public class MongoDbClient
{
    private readonly IMongoDatabase _database;

    public MongoDbClient(IOptions<MongoDbOptions> options)
    {
        var value = options.Value;

        // linq provider v3 has many improvement in version 2.14.x we should use it
        var clientSettings = MongoClientSettings.FromConnectionString(value.ConnectionString);
        clientSettings.LinqProvider = LinqProvider.V3;

        _database = new MongoClient(clientSettings).GetDatabase(value.Database);
    }

    public async Task<IList<BsonDocument>> GetFlagsAsync()
    {
        return await _database.GetCollection<BsonDocument>("FeatureFlags").AsQueryable().ToListAsync();
    }

    public async Task<IList<BsonDocument>> GetSegmentsAsync()
    {
        return await _database.GetCollection<BsonDocument>("Segments").AsQueryable().ToListAsync();
    }
}