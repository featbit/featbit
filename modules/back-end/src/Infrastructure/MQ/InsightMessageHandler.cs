using Application.Insights;
using Domain.Messages;

namespace Infrastructure.MQ;

public class InsightMessageHandler(InsightsTracker insightsTracker) : IMessageHandler
{
    public string Topic => Topics.Insights;

    public async Task HandleAsync(string message)
    {
        if (InsightParser.TryParse(message, out var insight))
        {
            await insightsTracker.RecordAsync(insight!);
        }
    }
}
