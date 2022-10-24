using System.Text.Json;
using Confluent.Kafka;
using Domain.Core;
using Infrastructure.Caches;

namespace Infrastructure.Kafka;

public class SegmentChangeMessageHandler : IKafkaMessageHandler
{
    public string Topic => Topics.SegmentChange;

    private readonly RedisService _redisService;

    public SegmentChangeMessageHandler(RedisService redisService)
    {
        _redisService = redisService;
    }

    public async Task HandleAsync(ConsumeResult<Null, string> consumeResult, CancellationToken cancellationToken)
    {
        var body = consumeResult.Message.Value;

        using var document = JsonDocument.Parse(body);
        var root = document.RootElement;
        if (!root.TryGetProperty("segment", out var segmentElement) ||
            !root.TryGetProperty("affectedFlagIds", out _))
        {
            throw new InvalidDataException("invalid segment change data");
        }

        await _redisService.UpsertSegmentAsync(segmentElement);
    }
}