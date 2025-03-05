using Dapper;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;

namespace Infrastructure.Services.EntityFrameworkCore;

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
            using var jsonDocument = JsonDocument.Parse(json);
            var root = jsonDocument.RootElement;

            var timestampMs = root.GetProperty("timestamp").GetInt64() / 1000;
            var timestamp = DateTimeOffset.FromUnixTimeMilliseconds(timestampMs).UtcDateTime;

            var item = new
            {
                uuid = root.GetProperty("uuid").GetGuid(),
                distinct_id = root.GetProperty("distinct_id").GetString(),
                env_id = root.GetProperty("env_id").GetString(),
                @event = root.GetProperty("event").GetString(),
                properties = root.GetProperty("properties").ToString(),
                timestamp
            };

            return item;
        }
    }

    public async Task AddManyAsync(IEnumerable<object> insights)
    {
        var connection = dbContext.Database.GetDbConnection();

        const string sql = """
                           insert into events (id, distinct_id, env_id, event, properties, timestamp) 
                           values (@uuid, @distinct_id, @env_id, @event, @properties::jsonb, @timestamp)
                           """;

        await connection.ExecuteAsync(sql, insights);
    }
}