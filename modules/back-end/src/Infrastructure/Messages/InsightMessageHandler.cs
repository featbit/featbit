using Domain.Messages;
using Infrastructure.AppService;

namespace Infrastructure.Messages;

public class InsightMessageHandler(InsightsWriter insightsWriter) : IMessageHandler
{
    public string Topic => Topics.Insights;

    public Task HandleAsync(string message, CancellationToken cancellationToken)
    {
        insightsWriter.TryAddInsight(message);

        return Task.CompletedTask;
    }
}