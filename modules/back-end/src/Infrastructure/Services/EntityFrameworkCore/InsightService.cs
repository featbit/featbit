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

            var item = new object?[]
            {
                root.GetProperty("uuid").GetGuid(),
                root.GetProperty("distinct_id").GetString(),
                root.GetProperty("env_id").GetString(),
                root.GetProperty("event").GetString(),
                root.GetProperty("properties").ToString(),
                timestamp
            };

            return item;
        }
    }

    public async Task AddManyAsync(object[] insights)
    {
        const string insertSql =
            "INSERT INTO events (id, distinct_id, env_id, event, properties, timestamp) VALUES {0}";

        var paramNames = string.Join(",", insights.Select(
            (_, i) => $"(@id{i}, @distinct_id{i}, @env_id{i}, @event{i}, @properties{i}::jsonb, @timestamp{i})")
        );

        var formattedSql = string.Format(insertSql, paramNames);

        var parameters = new DynamicParameters();

        for (var i = 0; i < insights.Length; i++)
        {
            var insight = (object[])insights[i];

            parameters.Add($"id{i}", insight[0]);
            parameters.Add($"distinct_id{i}", insight[1]);
            parameters.Add($"env_id{i}", insight[2]);
            parameters.Add($"event{i}", insight[3]);
            parameters.Add($"properties{i}", insight[4]);
            parameters.Add($"timestamp{i}", insight[5]);
        }

        var connection = dbContext.Database.GetDbConnection();
        await connection.ExecuteAsync(formattedSql, parameters);
    }
}