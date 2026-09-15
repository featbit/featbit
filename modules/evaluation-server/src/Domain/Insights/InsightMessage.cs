#nullable disable

using System.Text.Json;
using System.Text.Json.Serialization;
using Domain.EndUsers;

namespace Domain.Insights;

public class InsightMessage
{
    [JsonPropertyName("uuid")]
    public string Uuid { get; private set; }

    [JsonPropertyName("env_id")]
    public string EnvId { get; private set; }

    [JsonPropertyName("event")]
    public string Event { get; private set; }

    [JsonPropertyName("properties")]
    public string Properties { get; private set; }

    [JsonPropertyName("timestamp")]
    public long Timestamp { get; private set; }

    private InsightMessage(string envId, string @event, object properties, long timestampMs)
    {
        Uuid = Guid.NewGuid().ToString();
        EnvId = envId;
        Event = @event;
        Properties = JsonSerializer.Serialize(properties);
        Timestamp = timestampMs;
    }

    public static InsightMessage ForFlagValue(string envId, EndUser user, VariationInsight variationInsight)
    {
        var variation = variationInsight.Variation!;

        var properties = new
        {
            flagId = $"{envId}-{variationInsight.FeatureFlagKey}",
            featureFlagKey = variationInsight.FeatureFlagKey,
            userKeyId = user.KeyId,
            userName = user.Name,
            variationId = variation.Id,
            variationValue = variation.Value
        };

        return new InsightMessage(envId, "FlagValue", properties, variationInsight.Timestamp);
    }

    public static InsightMessage ForMetric(string envId, EndUser user, MetricInsight metric)
    {
        var properties = new
        {
            type = metric.Type,
            eventName = metric.EventName,
            numericValue = metric.NumericValue,
            user = new { keyId = user.KeyId, name = user.Name },
            applicationType = metric.AppType
        };

        return new InsightMessage(envId, metric.Type, properties, metric.Timestamp);
    }
}
