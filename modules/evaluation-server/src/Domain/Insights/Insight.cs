using System.Text.Json;
using Domain.EndUsers;

namespace Domain.Insights;

public class Insight
{
    public EndUser? User { get; set; }

    public VariationInsight?[]? Variations { get; set; } = [];

    public MetricInsight?[]? Metrics { get; set; } = [];

    public bool IsValid()
    {
        if (User == null || !User.IsValid())
        {
            return false;
        }

        if (Variations is not null && Variations.Any(x => x is null || !x.IsValid()))
        {
            return false;
        }

        if (Metrics is not null && Metrics.Any(x => x is null || !x.IsValid()))
        {
            return false;
        }

        return true;
    }

    public EndUserMessage EndUserMessage(Guid envId)
    {
        return new EndUserMessage(envId, User!);
    }

    public ICollection<InsightMessage> InsightMessages(Guid envId)
    {
        var messages = new List<InsightMessage>();
        var envIdString = $"{envId}";

        // flag messages
        if (Variations != null)
        {
            foreach (var variation in Variations)
            {
                if (variation?.Variation == null)
                {
                    continue;
                }

                var flagId = $"{envId}-{variation.FeatureFlagKey}";
                var properties = new
                {
                    route = "/Variation/GetMultiOptionVariation",
                    flagId = flagId,
                    envId = envIdString,
                    accountId = string.Empty,
                    projectId = string.Empty,
                    featureFlagKey = variation.FeatureFlagKey,
                    sendToExperiment = variation.SendToExperiment,
                    userKeyId = User!.KeyId,
                    userName = User!.Name,
                    variationId = variation.Variation.Id,
                    tag_0 = User!.KeyId,
                    tag_1 = variation.Variation.Id,
                    tag_2 = variation.SendToExperiment ? "true" : "false",
                    tag_3 = User!.Name
                };

                var message = new InsightMessage
                {
                    Uuid = Guid.NewGuid().ToString(),
                    DistinctId = flagId,
                    EnvId = envIdString,
                    Event = "FlagValue",
                    Properties = JsonSerializer.Serialize(properties),
                    Timestamp = variation.Timestamp * 1000 // milliseconds to microseconds
                };

                messages.Add(message);
            }
        }

        // metric messages
        if (Metrics != null)
        {
            foreach (var metric in Metrics)
            {
                if (metric is null)
                {
                    continue;
                }

                var properties = new
                {
                    route = metric.Route,
                    type = metric.Type,
                    eventName = metric.EventName,
                    numericValue = metric.NumericValue,
                    user = new { keyId = User!.KeyId, name = User!.Name },
                    applicationType = metric.AppType,
                    projectId = string.Empty,
                    envId = envIdString,
                    accountId = string.Empty,
                    tag_0 = User!.KeyId,
                    tag_1 = $"{metric.NumericValue}",
                    tag_2 = User!.Name
                };

                var message = new InsightMessage
                {
                    Uuid = Guid.NewGuid().ToString(),
                    DistinctId = metric.EventName,
                    EnvId = envIdString,
                    Event = metric.Type,
                    Properties = JsonSerializer.Serialize(properties),
                    Timestamp = metric.Timestamp * 1000 // milliseconds to microseconds
                };

                messages.Add(message);
            }
        }

        return messages;
    }
}