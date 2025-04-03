using System.Text.Json;
using Domain.Messages;
using Domain.Utils;
using Infrastructure.Caches.Redis;
using Microsoft.Extensions.Logging;
using StackExchange.Redis;

namespace Infrastructure.MQ.Redis;

public partial class RedisMessageProducer(IRedisClient redisClient, ILogger<RedisMessageProducer> logger)
    : IMessageProducer
{
    public async Task PublishAsync<TMessage>(string topic, TMessage message) where TMessage : class
    {
        try
        {
            var jsonMessage = JsonSerializer.Serialize(message, ReusableJsonSerializerOptions.Web);

            // Publish message to topic
            await redisClient.GetDatabase().PublishAsync(RedisChannel.Literal(topic), jsonMessage);

            Log.MessagePublished(logger, jsonMessage);
        }
        catch (Exception ex)
        {
            Log.ErrorPublishMessage(logger, ex);
        }
    }
}