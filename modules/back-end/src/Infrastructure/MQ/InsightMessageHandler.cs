using Domain.Messages;
using Infrastructure.AppService;

namespace Infrastructure.MQ;

public class InsightMessageHandler(IInsightService insightService, InsightsWriter insightsWriter) : IMessageHandler
{
    public string Topic => Topics.Insights;

    public async Task HandleAsync(string message)
    {
        if (insightService.TryParse(message, out var insight))
        {
            await insightsWriter.RecordAsync(insight);
        }
    }
}
