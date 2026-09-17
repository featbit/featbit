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
        foreach (var insight in validInsights)
        {
            var key = $"{envIdString}:{insight!.User!.KeyId}";
            if (!_cache.TryGetValue(key, out _))
            {
                _cache.Set(key, string.Empty, _cacheEntryOptions);
                endUserMessages.Add(insight.EndUserMessage(EnvId));
                usage.AddUser(insight.User!.KeyId);
            }

            insight.AppendInsightMessages(envIdString, insightMessages);
            usage.AddEvents(insight.Variations?.Length ?? 0, insight.Metrics?.Length ?? 0);
        }

        await Task.WhenAll(
            _producer.PublishBatchAsync(Topics.EndUser, endUserMessages),
            _producer.PublishBatchAsync(Topics.Insights, insightMessages),
            _producer.PublishAsync(Topics.Usage, usage)
        );

        return Ok();
    }
}
