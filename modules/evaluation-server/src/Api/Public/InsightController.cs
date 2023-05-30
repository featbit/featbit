using Domain.EndUsers;
using Domain.Insights;
using Domain.Messages;
using Microsoft.AspNetCore.Mvc;

namespace Api.Public;

public class InsightController : PublicApiControllerBase
{
    private readonly IMessageProducer _producer;

    public InsightController(IMessageProducer producer)
    {
        _producer = producer;
    }

    [HttpPost("track")]
    public async Task<IActionResult> TrackAsync(ICollection<Insight> insights)
    {
        if (!Authenticated)
        {
            return Unauthorized();
        }

        var validInsights = insights.Where(x => x.IsValid()).ToArray();
        if (!validInsights.Any())
        {
            return Ok();
        }

        var envId = EnvId;

        var endUserMessages = new List<EndUserMessage>();
        var insightMessages = new List<InsightMessage>();
        foreach (var insight in validInsights)
        {
            endUserMessages.Add(insight.EndUserMessage(envId));
            insightMessages.AddRange(insight.InsightMessages(envId));
        }

        await Task.WhenAll(
            endUserMessages.Select(x => _producer.PublishAsync(Topics.EndUser, x))
        );
        await Task.WhenAll(
            insightMessages.Select(x => _producer.PublishAsync(Topics.Insights, x))
        );

        return Ok();
    }
}