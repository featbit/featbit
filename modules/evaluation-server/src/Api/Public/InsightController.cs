using Api.Setup;
using Domain.EndUsers;
using Domain.Insights;
using Domain.Messages;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Caching.Memory;

namespace Api.Public;

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
    public async Task<IActionResult> TrackAsync(ICollection<Insight> insights)
    {
        if (!Authenticated)
        {
            return Unauthorized();
        }

        var validInsights = insights.Where(x => x.IsValid()).ToArray();
        if (validInsights.Length == 0)
        {
            return Ok();
        }

        var envId = EnvId;

        var endUserMessages = new List<EndUserMessage>();
        var insightMessages = new List<InsightMessage>();
        foreach (var insight in validInsights)
        {
            var key = $"{envId:N}:{insight.User!.KeyId}";
            if (!_cache.TryGetValue(key, out _))
            {
                _cache.Set(key, string.Empty, _cacheEntryOptions);
                endUserMessages.Add(insight.EndUserMessage(envId));
            }

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