using Api.Authorization;
using Microsoft.AspNetCore.Authorization;
using Api.RateLimiting;
using Domain.EndUsers;
using Domain.Insights;
using Domain.Messages;
using Domain.Usages;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace Api.Public;

[Route("api/public/insight")]
[EnableRateLimiting(RateLimitingPolicies.Insight)]
public class InsightController(IMessageProducer producer, EndUserDeduplicator endUserDeduplicator)
    : ApiControllerBase
{
    [HttpPost("track")]
    [Authorize(SecretPolicies.ServerOrClient)]
    public async Task<IActionResult> TrackAsync(ICollection<Insight?> insights)
    {
        var validInsights = insights.Where(x => x != null && x.IsValid()).ToArray();
        if (validInsights.Length == 0)
        {
            return Ok();
        }

        var envIdString = EnvId.ToString();

        var endUserMessages = new List<EndUserMessage>(validInsights.Length);
        var insightMessages = new List<InsightMessage>(validInsights.Length);
        var usage = new InsightUsage(EnvId);
        foreach (var insight in validInsights)
        {
            if (endUserDeduplicator.TryMarkAsReported(EnvId, insight!.User!.KeyId))
            {
                endUserMessages.Add(insight.EndUserMessage(EnvId));
                usage.AddUser(insight.User!.KeyId);
            }

            insight.AppendInsightMessages(envIdString, insightMessages);
            usage.AddEvents(insight.Variations?.Length ?? 0, insight.Metrics?.Length ?? 0);
        }

        await Task.WhenAll(
            producer.PublishBatchAsync(Topics.EndUser, endUserMessages),
            producer.PublishBatchAsync(Topics.Insights, insightMessages),
            producer.PublishAsync(Topics.Usage, usage)
        );

        return Ok();
    }
}
