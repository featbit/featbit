using System.Text;
using System.Text.Json;
using MongoDB.Bson;

namespace Infrastructure.Persistence.MongoDb;

public static class BsonDocumentExtensions
{
    public static byte[] ToJsonBytes(this BsonDocument bsonDocument)
    {
        var dictionary = bsonDocument.ToDictionary();

        var json = JsonSerializer.Serialize(dictionary);
        var normalizedJson = json.Replace("\"_id\":", "\"id\":");

        return Encoding.UTF8.GetBytes(normalizedJson);
    }

    public static JsonElement ToJsonElement(this BsonDocument bsonDocument)
    {
        var dictionary = bsonDocument.ToDictionary();

        var json = JsonSerializer.Serialize(dictionary);
        var normalizedJson = json.Replace("\"_id\":", "\"id\":");

        return JsonSerializer.Deserialize<JsonElement>(normalizedJson);
    }
}