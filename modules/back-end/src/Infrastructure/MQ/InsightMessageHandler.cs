using Domain.Messages;
using Infrastructure.AppService;

namespace Infrastructure.MQ;

public class InsightMessageHandler(IInsightService insightService, InsightsWriter insightsWriter) : IMessageHandler
{
    public string Topic => Topics.Insights;

    public Task HandleAsync(string message)
    {
        if (!insightService.TryParse(message, out var insight))
        {
            throw new InvalidOperationException("Failed to parse insight message.");
        }

        insightsWriter.Record(insight!);

        return Task.CompletedTask;
    }
}
