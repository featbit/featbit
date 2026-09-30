using System.Text;
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
            // The serialized payload is already in hand here, so its size costs a byte count rather
            // than a second serialization. This is the only insights enqueue path.
            await insightsTracker.RecordAsync(insight!, Encoding.UTF8.GetByteCount(message));
        }
    }
}
