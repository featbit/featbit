using Domain.EndUsers;
using Domain.Insights;
using Domain.Messages;
using Infrastructure.Redis;
using Microsoft.AspNetCore.Mvc;
using StackExchange.Redis;

namespace Api.Public;

public class InsightController : PublicApiControllerBase
{
    private readonly IMessageProducer _producer;
    private readonly IDatabase _redis;

    public InsightController(IMessageProducer producer, IRedisClient redisClient)
    {
        _producer = producer;
        _redis = redisClient.GetDatabase();
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
            var endUserMessage = insight.EndUserMessage(envId);
            if (!_redis.KeyExists(RedisKeys.EndUser(envId, endUserMessage.KeyId)))
            {
                endUserMessages.Add(endUserMessage);
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