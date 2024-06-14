using Microsoft.Extensions.Options;
using MongoDB.Bson;
using MongoDB.Driver;
using MongoDB.Driver.Linq;

namespace Infrastructure.MongoDb;

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

        // linq provider v3 has many improvement in version 2.14.x we should use it
        var clientSettings = MongoClientSettings.FromConnectionString(value.ConnectionString);
        clientSettings.LinqProvider = LinqProvider.V3;

        Database = new MongoClient(clientSettings).GetDatabase(value.Database);
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