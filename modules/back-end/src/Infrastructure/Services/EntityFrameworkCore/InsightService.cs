using Application.FeatureFlags;
using Application.Insights;
using Dapper;
using Domain.Experiments;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using NpgsqlTypes;

namespace Infrastructure.Services.EntityFrameworkCore;

public class InsightService(AppDbContext dbContext) : IInsightService
{
    public async Task AddManyAsync(object[] insights)
    {
        if (insights.Length == 0)
        {
            return;
        }

        await dbContext.Database.OpenConnectionAsync();

        try
        {
            await using var transaction = await dbContext.Database.BeginTransactionAsync();
            var connection = (NpgsqlConnection)dbContext.Database.GetDbConnection();

            if (insights.Any(x => x is ExperimentExposureEvent))
            {
                await CopyExposuresAsync(connection, insights);
            }

            if (insights.Any(x => x is ExperimentMetricEvent))
            {
                await CopyMetricsAsync(connection, insights);
            }

            await transaction.CommitAsync();
        }
        finally
        {
            await dbContext.Database.CloseConnectionAsync();
        }
    }

    public async Task<ICollection<Insight>> GetInsightsAsync(Guid envId, InsightFilter filter)
    {
        var bucket = filter.IntervalType switch
        {
            IntervalType.Month => "date_trunc('month', exposed_at)",
            IntervalType.Week => "date_trunc('week', exposed_at)",
            IntervalType.Day => "date_trunc('day', exposed_at)",
            IntervalType.Hour => "date_trunc('hour', exposed_at)",
            IntervalType.Minute => "date_trunc('minute', exposed_at)",
            _ => throw new ArgumentException($"Unsupported interval type: {filter.IntervalType}", nameof(filter.IntervalType))
        };

        var from = DateTimeOffset.FromUnixTimeMilliseconds(filter.From);
        var to = DateTimeOffset.FromUnixTimeMilliseconds(filter.To);

        var sql = $"""
                   SELECT
                       {bucket} AS Bucket,
                       variation_id AS VariationId,
                       count(*)::int AS Count
                   FROM experiment_exposure_events
                   WHERE env_id = @EnvId
                     AND flag_key = @FeatureFlagKey
                     AND exposed_at >= @From
                     AND exposed_at <= @To
                     AND variation_id IS NOT NULL
                   GROUP BY Bucket, VariationId
                   ORDER BY Bucket
                   """;

        var connection = dbContext.Database.GetDbConnection();
        var rows = await connection.QueryAsync<InsightRow>(
            sql,
            new
            {
                EnvId = envId,
                filter.FeatureFlagKey,
                From = from,
                To = to
            });

        return rows
            .GroupBy(x => x.Bucket)
            .Select(group => new Insight
            {
                Time = DateTime.SpecifyKind(group.Key, DateTimeKind.Utc).ToString("O"),
                Variations = group
                    .Select(x => new VariationInsights { Id = x.VariationId, Val = x.Count })
                    .ToArray()
            })
            .ToArray();
    }

    private static async Task CopyExposuresAsync(NpgsqlConnection connection, object[] insights)
    {
        await using var writer = await connection.BeginBinaryImportAsync("""
            COPY experiment_exposure_events
                (id, env_id, flag_key, user_key, variation_id, variation_value, exposed_at, properties, created_at)
            FROM STDIN (FORMAT BINARY)
            """);

        foreach (var insight in insights)
        {
            if (insight is not ExperimentExposureEvent exposure)
            {
                continue;
            }

            await writer.StartRowAsync();
            await writer.WriteAsync(exposure.Id, NpgsqlDbType.Uuid);
            await writer.WriteAsync(exposure.EnvId, NpgsqlDbType.Uuid);
            await writer.WriteAsync(exposure.FlagKey, NpgsqlDbType.Varchar);
            await writer.WriteAsync(exposure.UserKey, NpgsqlDbType.Varchar);
            await writer.WriteAsync(exposure.VariationId, NpgsqlDbType.Varchar);
            if (exposure.VariationValue is null)
            {
                await writer.WriteNullAsync();
            }
            else
            {
                await writer.WriteAsync(exposure.VariationValue, NpgsqlDbType.Varchar);
            }

            await writer.WriteAsync(exposure.ExposedAt, NpgsqlDbType.TimestampTz);
            await writer.WriteAsync(exposure.Properties, NpgsqlDbType.Jsonb);
            await writer.WriteAsync(exposure.CreatedAt, NpgsqlDbType.TimestampTz);
        }

        await writer.CompleteAsync();
    }

    private static async Task CopyMetricsAsync(NpgsqlConnection connection, object[] insights)
    {
        await using var writer = await connection.BeginBinaryImportAsync("""
            COPY experiment_metric_events
                (id, env_id, user_key, event_name, event_type, numeric_value, occurred_at, properties, created_at)
            FROM STDIN (FORMAT BINARY)
            """);

        foreach (var insight in insights)
        {
            if (insight is not ExperimentMetricEvent metric)
            {
                continue;
            }

            await writer.StartRowAsync();
            await writer.WriteAsync(metric.Id, NpgsqlDbType.Uuid);
            await writer.WriteAsync(metric.EnvId, NpgsqlDbType.Uuid);
            await writer.WriteAsync(metric.UserKey, NpgsqlDbType.Varchar);
            await writer.WriteAsync(metric.EventName, NpgsqlDbType.Varchar);
            await writer.WriteAsync(metric.EventType, NpgsqlDbType.Varchar);
            await writer.WriteAsync(metric.NumericValue, NpgsqlDbType.Double);
            await writer.WriteAsync(metric.OccurredAt, NpgsqlDbType.TimestampTz);
            await writer.WriteAsync(metric.Properties, NpgsqlDbType.Jsonb);
            await writer.WriteAsync(metric.CreatedAt, NpgsqlDbType.TimestampTz);
        }

        await writer.CompleteAsync();
    }

    private sealed class InsightRow
    {
        public DateTime Bucket { get; init; }
        public string VariationId { get; init; } = string.Empty;
        public int Count { get; init; }
    }
}
