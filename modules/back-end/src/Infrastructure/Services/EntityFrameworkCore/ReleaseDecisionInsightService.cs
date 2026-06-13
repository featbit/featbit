using Microsoft.EntityFrameworkCore;
using System.Text.Json;
using Npgsql;

namespace Infrastructure.Services.EntityFrameworkCore;

public class ReleaseDecisionInsightService(AppDbContext dbContext) : IInsightService
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

        ReleaseDecisionPostgresInsightEvent Parse()
        {
            using var jsonDocument = JsonDocument.Parse(json);
            var root = jsonDocument.RootElement;

            var timestampMs = root.GetProperty("timestamp").GetInt64() / 1000;
            var timestampOffset = DateTimeOffset.FromUnixTimeMilliseconds(timestampMs);

            return new ReleaseDecisionPostgresInsightEvent(
                root.GetProperty("uuid").GetGuid(),
                root.GetProperty("distinct_id").GetString(),
                root.GetProperty("env_id").GetString(),
                root.GetProperty("event").GetString(),
                root.GetProperty("properties").GetString(),
                timestampOffset);
        }
    }

    public async Task AddManyAsync(object[] insights)
    {
        var events = insights.Cast<ReleaseDecisionPostgresInsightEvent>().ToArray();

        await dbContext.Database.OpenConnectionAsync();

        try
        {
            var conn = dbContext.Database.GetDbConnection() as NpgsqlConnection;
            await ReleaseDecisionInsightWriter.WriteAsync(conn!, events);
        }
        finally
        {
            await dbContext.Database.CloseConnectionAsync();
        }
    }
}
