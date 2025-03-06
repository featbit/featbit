using Microsoft.EntityFrameworkCore;
using System.Text.Json;
using Npgsql;
using NpgsqlTypes;

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
            var timestamp = DateTimeOffset.FromUnixTimeMilliseconds(timestampMs).DateTime;

            var item = new object?[]
            {
                root.GetProperty("uuid").GetGuid(),
                root.GetProperty("distinct_id").GetString(),
                root.GetProperty("env_id").GetString(),
                root.GetProperty("event").GetString(),
                root.GetProperty("properties").GetString(),
                timestamp
            };

            return item;
        }
    }

    public async Task AddManyAsync(object[] insights)
    {
        await dbContext.Database.OpenConnectionAsync();

        try
        {
            var conn = dbContext.Database.GetDbConnection() as NpgsqlConnection;

            await using var writer = await conn!.BeginBinaryImportAsync(
                "COPY events (id, distinct_id, env_id, event, properties, timestamp) FROM STDIN (FORMAT BINARY)"
            );

            foreach (var insight in insights)
            {
                var values = (object[])insight;

                await writer.StartRowAsync();

                await writer.WriteAsync(values[0], NpgsqlDbType.Uuid);
                await writer.WriteAsync(values[1], NpgsqlDbType.Varchar);
                await writer.WriteAsync(values[2], NpgsqlDbType.Varchar);
                await writer.WriteAsync(values[3], NpgsqlDbType.Varchar);
                await writer.WriteAsync(values[4], NpgsqlDbType.Jsonb);
                await writer.WriteAsync(values[5], NpgsqlDbType.Timestamp);
            }

            await writer.CompleteAsync();
        }
        finally
        {
            await dbContext.Database.CloseConnectionAsync();
        }
    }
}