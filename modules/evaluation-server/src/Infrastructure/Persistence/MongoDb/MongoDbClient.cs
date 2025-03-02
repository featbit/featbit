using Microsoft.Extensions.Options;
using MongoDB.Bson;
using MongoDB.Driver;

namespace Infrastructure.Persistence.MongoDb;

public class MongoDbClient : IMongoDbClient
{
    private static readonly BsonDocumentCommand<BsonDocument> Ping = new(BsonDocument.Parse("{ping:1}"));

    public IMongoDatabase Database { get; }

    public MongoDbClient(IOptions<MongoDbOptions> options)
    {
#pragma warning disable 618
        BsonDefaults.GuidRepresentationMode = GuidRepresentationMode.V3;
#pragma warning restore

        var value = options.Value;

        Database = new MongoClient(value.ConnectionString).GetDatabase(value.Database);
    }

    public async Task<bool> IsHealthyAsync()
    {
        try
        {
            await Database.RunCommandAsync(Ping);
            return true;
        }
        catch (Exception)
        {
            return false;
        }
    }
}