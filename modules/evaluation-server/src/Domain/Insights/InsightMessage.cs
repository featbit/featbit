#nullable disable

using System.Text.Json.Serialization;
using Domain.EndUsers;

namespace Domain.Insights;

public class InsightMessage
{
    // Version 2 identifies the v6 insight message contract; legacy messages have no version.
    [JsonPropertyName("schema_version")]
    public int SchemaVersion => 2;

    [JsonPropertyName("uuid")]
    public string Uuid { get; private set; }

    [JsonPropertyName("env_id")]
    public string EnvId { get; private set; }

    [JsonPropertyName("event")]
    public string Event { get; private set; }

    [JsonPropertyName("properties")]
    public object Properties { get; private set; }

    [JsonPropertyName("timestamp")]
    public long Timestamp { get; private set; }

    private InsightMessage(string envId, string @event, object properties, long timestampMs)
    {
        Uuid = Guid.NewGuid().ToString();
        EnvId = envId;
        Event = @event;
        Properties = properties;
        Timestamp = timestampMs;
    }

    public static InsightMessage ForFlagValue(string envId, EndUser user, VariationInsight variationInsight)
    {
        var variation = variationInsight.Variation!;

        var properties = new
        {
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
            eventName = metric.EventName,
            numericValue = metric.NumericValue,
            userKeyId = user.KeyId,
            applicationType = metric.AppType
        };

        return new InsightMessage(envId, metric.Type, properties, metric.Timestamp);
    }
}
