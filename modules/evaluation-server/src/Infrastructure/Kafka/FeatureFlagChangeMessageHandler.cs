using System.Text.Json;
using Confluent.Kafka;
using Domain.Core;
using Infrastructure.Caches;

namespace Infrastructure.Kafka;

public class FeatureFlagChangeMessageHandler : IKafkaMessageHandler
{
    public string Topic => Topics.FeatureFlagChange;

    private readonly RedisService _redisService;

    public FeatureFlagChangeMessageHandler(RedisService redisService)
    {
        _redisService = redisService;
    }

    public async Task HandleAsync(ConsumeResult<Null, string> consumeResult)
    {
        var body = consumeResult.Message.Value;

        using var document = JsonDocument.Parse(body);
        await _redisService.UpsertFlagAsync(document.RootElement);
    }
}