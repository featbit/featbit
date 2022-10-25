using System.Text.Json;
using MongoDB.Bson;

namespace Infrastructure.MongoDb;

public static class BsonDocumentExtensions
{
    public static string AsJson(this BsonDocument bsonDocument)
    {
        var json = JsonSerializer.Serialize(bsonDocument.ToDictionary());

        return json.Replace("\"_id\":", "\"id\":");
    }
}