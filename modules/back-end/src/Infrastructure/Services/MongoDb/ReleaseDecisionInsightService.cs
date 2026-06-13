using System.Text.Json.Nodes;
using MongoDB.Bson;

namespace Infrastructure.Services.MongoDb;

public class ReleaseDecisionInsightService(MongoDbClient mongoDb) : IInsightService
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

            jsonNode["_id"] = jsonNode["uuid"]!.GetValue<string>();
            jsonNode.Remove("uuid");

            jsonNode["properties"] = JsonNode.Parse(jsonNode["properties"]!.GetValue<string>());

            var timestampInMilliseconds = jsonNode["timestamp"]!.GetValue<long>() / 1000;
            var timestamp = DateTimeOffset.FromUnixTimeMilliseconds(timestampInMilliseconds).UtcDateTime;
            jsonNode["timestamp"] = timestamp;

            var bsonDocument = BsonDocument.Parse(jsonNode.ToJsonString());
            bsonDocument["timestamp"] = timestamp;

            return bsonDocument;
        }
    }

    public async Task AddManyAsync(object[] insights)
    {
        var documents = insights.Cast<BsonDocument>().ToArray();
        await ReleaseDecisionInsightWriter.WriteAsync(mongoDb, documents);
    }
}
