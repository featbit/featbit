using System.Text.Json;
using Domain.EndUsers;

namespace Domain.Insights;

public class Insight
{
    public EndUser? User { get; set; }

    public IEnumerable<VariationInsight> Variations { get; set; } = Array.Empty<VariationInsight>();

    public IEnumerable<MetricInsight> Metrics { get; set; } = Array.Empty<MetricInsight>();

    public bool IsValid()
    {
        return User != null && User.IsValid();
    }

    public EndUserMessage EndUserMessage(Guid envId)
    {
        return new EndUserMessage(envId, User!);
    }

    public ICollection<InsightMessage> InsightMessages(Guid envId)
    {
        var messages = new List<InsightMessage>();

        // flag messages
        foreach (var variation in Variations)
        {
            var flagId = $"{envId}-{variation.FeatureFlagKeyName}";
            var properties = new
            {
                RequestPath = "/Variation/GetMultiOptionVariation",
                FeatureFlagId = flagId,
                EnvId = envId.ToString(),
                AccountId = string.Empty,
                ProjectId = string.Empty,
                FeatureFlagKeyName = variation.FeatureFlagKeyName,
                UserKeyId = User!.KeyId,
                FFUserName = User!.Name,
                VariationLocalId = variation.Variation.Id,
                tag_0 = User!.KeyId,
                tag_1 = variation.Variation.Id
            };

            var message = new InsightMessage
            {
                Uuid = Guid.NewGuid().ToString(),
                DistinctId = flagId,
                EnvId = envId.ToString(),
                Event = "FlagValue",
                Properties = JsonSerializer.Serialize(properties),
                Timestamp = DateTimeOffset.FromUnixTimeMilliseconds(variation.Timestamp).ToString("yyyy-MM-dd HH:mm:ss.ffffff")
            };

            messages.Add(message);
        }

        // metric messages
        foreach (var metric in Metrics)
        {
            var properties = new
            {
                Route = metric.Route,
                Type = metric.Type,
                EventName = metric.EventName,
                NumericValue = metric.NumericValue,
                User = User!,
                ApplicationType = metric.AppType,
                ProjectId = string.Empty,
                EnvironmentId = envId.ToString(),
                AccountId = string.Empty,
                tag_0 = User!.KeyId,
                tag_1 = metric.NumericValue,
            };

            var message = new InsightMessage
            {
                Uuid = Guid.NewGuid().ToString(),
                DistinctId = metric.EventName,
                EnvId = envId.ToString(),
                Event = metric.Type,
                Properties = JsonSerializer.Serialize(properties),
                Timestamp = DateTime.UtcNow.ToString("yyyy-MM-dd HH:mm:ss.ffffff")
            };

            messages.Add(message);
        }

        return messages;
    }
}