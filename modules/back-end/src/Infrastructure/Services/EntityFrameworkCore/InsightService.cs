namespace Infrastructure.Services.EntityFrameworkCore;
using Dapper;
using Microsoft.EntityFrameworkCore;
using System.Dynamic;
using System.Text.Json;
using System.Text.Json.Nodes;

public class InsightService(AppDbContext dbContext) : IInsightService
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
            var jsonObject = JsonSerializer.Deserialize<JsonObject>(json)!.AsObject();

            dynamic insightObj = new ExpandoObject();
            insightObj.Uuid = jsonObject["uuid"]?.GetValue<string>();
            insightObj.DistinctId = jsonObject["distinct_id"]?.GetValue<string>();
            insightObj.EnvId = jsonObject["env_id"]?.GetValue<string>();
            insightObj.Event = jsonObject["event"]?.GetValue<string>();
            insightObj.Properties = jsonObject["properties"]?.ToString();
            var timestampInMilliseconds = jsonObject["timestamp"]!.GetValue<long>() / 1000;
            insightObj.Timestamp = DateTimeOffset.FromUnixTimeMilliseconds(timestampInMilliseconds).UtcDateTime;

            return insightObj;
        }
    }

    public async Task AddManyAsync(object[] insights)
    {
        var connection = dbContext.Database.GetDbConnection();
        var sql = "INSERT INTO Events (id, distinct_id, env_id, event, properties, timestamp) VALUES (@Uuid, @DistinctId, @EnvId, @Event, CAST(@Properties AS json), @Timestamp)";
        var insertList = new List<object>();
        foreach (var insight in insights)
        {
            dynamic di = insight;
            insertList.Add(new
            {
                Uuid = Guid.Parse(di.Uuid),
                di.DistinctId,
                di.EnvId,
                di.Event,
                di.Properties,
                di.Timestamp
            });
        };
        await connection.ExecuteAsync(sql, insertList);
    }
}