using System.Text.Json;
using Application.Usages;
using Domain.Messages;
using Microsoft.Extensions.Logging;

namespace Infrastructure.MQ;

public static class UsageTypes
{
    public const string Insight = "insight";
}

public class UsageMessageHandler(UsageTracker usageTracker, ILogger<UsageMessageHandler> logger) : IMessageHandler
{
    public string Topic => Topics.Usage;

    public Task HandleAsync(string message)
    {
        using var json = JsonDocument.Parse(message);
        var rootElement = json.RootElement;

        // validate required properties
        if (!rootElement.TryGetProperty("type", out var usageTypeElem) ||
            !rootElement.TryGetProperty("envId", out var envIdProp) ||
            !envIdProp.TryGetGuid(out var envId))
        {
            logger.LogWarning("Received invalid usage message: {Message}", message);
            return Task.CompletedTask;
        }

        var usageType = usageTypeElem.GetString();
        if (usageType == UsageTypes.Insight)
        {
            RecordInsightUsage();
        }

        return Task.CompletedTask;

        void RecordInsightUsage()
        {
            var endUsers = rootElement.TryGetProperty("endUsers", out var endUsersElem)
                ? endUsersElem.Deserialize<string[]>()!
                : [];

            var flagEvaluations = rootElement.TryGetProperty("flagEvaluations", out var flagEvaluationsElem)
                ? flagEvaluationsElem.GetInt32()
                : 0;

            var customMetrics = rootElement.TryGetProperty("customMetrics", out var customMetricsElem)
                ? customMetricsElem.GetInt32()
                : 0;

            usageTracker.RecordInsights(envId, endUsers, flagEvaluations, customMetrics);
        }
    }
}