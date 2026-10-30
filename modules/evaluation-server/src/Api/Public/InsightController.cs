using Api.RateLimiting;
using Api.Setup;
using Domain.EndUsers;
using Domain.Insights;
using Domain.Messages;
using Domain.Usages;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.Caching.Memory;

namespace Api.Public;

[Route("api/public/insight")]
[EnableRateLimiting(RateLimitingPolicies.Insight)]
public class InsightController : PublicApiControllerBase
{
    private readonly IMessageProducer _producer;
    private readonly MemoryCache _cache;
    private readonly MemoryCacheEntryOptions _cacheEntryOptions;

    public InsightController(IMessageProducer producer, BoundedMemoryCache boundedMemoryCache)
    {
        _producer = producer;
        _cache = boundedMemoryCache.Instance;
        _cacheEntryOptions = new MemoryCacheEntryOptions
        {
            Size = 1,
            AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(3)
        };
    }

    [HttpPost("track")]
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
        var newUserKeys = new HashSet<string>();
        foreach (var insight in validInsights)
        {
            var key = $"{envIdString}:{insight!.User!.KeyId}";
            if (!_cache.TryGetValue(key, out _) && newUserKeys.Add(key))
            {
                endUserMessages.Add(insight.EndUserMessage(EnvId));
                usage.AddUser(insight.User!.KeyId);
            }

            insight.AppendInsightMessages(envIdString, insightMessages);
            usage.AddEvents(insight.Variations?.Length ?? 0, insight.Metrics?.Length ?? 0);
        }

        try
        {
            await Task.WhenAll(
                _producer.PublishBatchAsync(Topics.EndUser, endUserMessages),
                _producer.PublishBatchAsync(Topics.Insights, insightMessages),
                _producer.PublishAsync(Topics.Usage, usage)
            );
        }
        catch (Exception)
        {
            // A partial publish can be retried; do not suppress user data that was not confirmed.
            // Retried requests may repeat records already accepted by another topic.
            return StatusCode(StatusCodes.Status503ServiceUnavailable);
        }

        foreach (var key in newUserKeys)
            _cache.Set(key, string.Empty, _cacheEntryOptions);

        return Ok();
    }
}
