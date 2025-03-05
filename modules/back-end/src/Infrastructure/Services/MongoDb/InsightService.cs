using System.Text.Json.Nodes;
using MongoDB.Bson;

namespace Infrastructure.Services.MongoDb;

public class InsightService(MongoDbClient mongoDb) : IInsightService
{
    public bool TryParse(string json, out object? insight)
    {
        try
        {
            insight = Parse();
        }
        catch
        {
            insight = null;
        }

        return insight != null;

        object Parse()
        {
            var jsonNode = JsonNode.Parse(json)!.AsObject();

            // Replace uuid with _id
            jsonNode["_id"] = jsonNode["uuid"]!.GetValue<string>();
            jsonNode.Remove("uuid");

            // Convert properties JSON string to object
            jsonNode["properties"] = JsonNode.Parse(jsonNode["properties"]!.GetValue<string>());

            // Convert timestamp to UTC DateTime
            var timestampInMilliseconds = jsonNode["timestamp"]!.GetValue<long>() / 1000;
            var timestamp = DateTimeOffset.FromUnixTimeMilliseconds(timestampInMilliseconds).UtcDateTime;
            jsonNode["timestamp"] = timestamp;

            // Convert JSON object to BSON document
            var bsonDocument = BsonDocument.Parse(jsonNode.ToJsonString());
            // Change timestamp type to DateTime, otherwise it will be String
            bsonDocument["timestamp"] = timestamp;

            return bsonDocument;
        }
    }

    public async Task AddManyAsync(object[] insights) =>
        await mongoDb.CollectionOf("Events").InsertManyAsync(insights as BsonDocument[]);
}