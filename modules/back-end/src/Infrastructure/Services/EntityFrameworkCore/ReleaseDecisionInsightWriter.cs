using System.Globalization;
using System.Text.Json;
using Npgsql;
using NpgsqlTypes;

namespace Infrastructure.Services.EntityFrameworkCore;

internal static class ReleaseDecisionInsightWriter
{
    public static async Task WriteAsync(NpgsqlConnection conn, ReleaseDecisionPostgresInsightEvent[] events)
    {
        var exposures = events
            .Select(TryBuildExposure)
            .Where(x => x != null)
            .Cast<object?[]>()
            .ToArray();

        if (exposures.Length > 0)
        {
            await WriteExposuresAsync(conn, exposures);
        }

        var metrics = events
            .Select(TryBuildMetric)
            .Where(x => x != null)
            .Cast<object?[]>()
            .ToArray();

        if (metrics.Length > 0)
        {
            await WriteMetricsAsync(conn, metrics);
        }
    }

    private static async Task WriteExposuresAsync(NpgsqlConnection conn, object?[][] exposures)
    {
        await using var writer = await conn.BeginBinaryImportAsync(
            """
            COPY release_decision_exposure_events
            (id, env_id, flag_key, user_key, variation_id, variation_value, exposed_at, properties)
            FROM STDIN (FORMAT BINARY)
            """
        );

        foreach (var values in exposures)
        {
            await writer.StartRowAsync();
            await writer.WriteAsync(values[0], NpgsqlDbType.Uuid);
            await writer.WriteAsync(values[1], NpgsqlDbType.Uuid);
            await writer.WriteAsync(values[2], NpgsqlDbType.Varchar);
            await writer.WriteAsync(values[3], NpgsqlDbType.Varchar);
            await writer.WriteAsync(values[4], NpgsqlDbType.Varchar);
            await writer.WriteAsync(values[5], NpgsqlDbType.Varchar);
            await writer.WriteAsync(values[6], NpgsqlDbType.TimestampTz);
            await writer.WriteAsync(values[7], NpgsqlDbType.Jsonb);
        }

        await writer.CompleteAsync();
    }

    private static async Task WriteMetricsAsync(NpgsqlConnection conn, object?[][] metrics)
    {
        await using var writer = await conn.BeginBinaryImportAsync(
            """
            COPY release_decision_metric_events
            (id, env_id, user_key, event_name, event_type, numeric_value, occurred_at, properties)
            FROM STDIN (FORMAT BINARY)
            """
        );

        foreach (var values in metrics)
        {
            await writer.StartRowAsync();
            await writer.WriteAsync(values[0], NpgsqlDbType.Uuid);
            await writer.WriteAsync(values[1], NpgsqlDbType.Uuid);
            await writer.WriteAsync(values[2], NpgsqlDbType.Varchar);
            await writer.WriteAsync(values[3], NpgsqlDbType.Varchar);
            await writer.WriteAsync(values[4], NpgsqlDbType.Varchar);
            await writer.WriteAsync(values[5], NpgsqlDbType.Double);
            await writer.WriteAsync(values[6], NpgsqlDbType.TimestampTz);
            await writer.WriteAsync(values[7], NpgsqlDbType.Jsonb);
        }

        await writer.CompleteAsync();
    }

    private static object?[]? TryBuildExposure(ReleaseDecisionPostgresInsightEvent insight)
    {
        if (insight.EventName != "FlagValue" ||
            !Guid.TryParse(insight.EnvId, out var parsedEnvId))
        {
            return null;
        }

        using var document = JsonDocument.Parse(insight.Properties!);
        var root = document.RootElement;
        var flagKey = GetString(root, "featureFlagKey");
        var userKey = GetString(root, "tag_0");
        var variationId = GetString(root, "tag_1");
        var variationValue = GetString(root, "variationValue");

        return string.IsNullOrWhiteSpace(flagKey) ||
               string.IsNullOrWhiteSpace(userKey) ||
               string.IsNullOrWhiteSpace(variationId)
            ? null
            :
            [
                insight.Id,
                parsedEnvId,
                flagKey,
                userKey,
                variationId,
                variationValue,
                insight.Timestamp,
                insight.Properties
            ];
    }

    private static object?[]? TryBuildMetric(ReleaseDecisionPostgresInsightEvent insight)
    {
        if (insight.EventName == "FlagValue" ||
            !Guid.TryParse(insight.EnvId, out var parsedEnvId))
        {
            return null;
        }

        using var document = JsonDocument.Parse(insight.Properties!);
        var root = document.RootElement;
        var userKey = GetString(root, "tag_0");
        var metricEvent = GetString(root, "eventName") ?? insight.DistinctId;

        return string.IsNullOrWhiteSpace(userKey) ||
               string.IsNullOrWhiteSpace(metricEvent) ||
               string.IsNullOrWhiteSpace(insight.EventName)
            ? null
            :
            [
                insight.Id,
                parsedEnvId,
                userKey,
                metricEvent,
                insight.EventName,
                GetNumericValue(root),
                insight.Timestamp,
                insight.Properties
            ];
    }

    private static string? GetString(JsonElement element, string property)
    {
        return element.TryGetProperty(property, out var value) && value.ValueKind == JsonValueKind.String
            ? value.GetString()
            : null;
    }

    private static double GetNumericValue(JsonElement properties)
    {
        if (properties.TryGetProperty("numericValue", out var numericValue) &&
            numericValue.ValueKind == JsonValueKind.Number &&
            numericValue.TryGetDouble(out var parsed))
        {
            return parsed;
        }

        return double.TryParse(GetString(properties, "tag_1"), NumberStyles.Float, CultureInfo.InvariantCulture, out var tagValue)
            ? tagValue
            : 0;
    }
}
