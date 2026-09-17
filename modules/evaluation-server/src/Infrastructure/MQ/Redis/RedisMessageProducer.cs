using System.Text.Json;
using Domain.Messages;
using Domain.Shared;
using Infrastructure.Caches.Redis;
using Microsoft.Extensions.Logging;
using StackExchange.Redis;

namespace Infrastructure.MQ.Redis;

public partial class RedisMessageProducer(IRedisClient redisClient, ILogger<RedisMessageProducer> logger)
    : IMessageProducer
{
    public async Task PublishAsync<TMessage>(string topic, TMessage? message) where TMessage : class
    {
        try
        {
            var jsonMessage = JsonSerializer.Serialize(message, ReusableJsonSerializerOptions.Web);

            // RPush json message to topic list
            await redisClient.GetDatabase().ListRightPushAsync(topic, jsonMessage);

            Log.MessagePublished(logger, jsonMessage);
        }
        catch (Exception ex)
        {
            Log.ErrorPublishMessage(logger, ex);
        }
    }

    public async Task PublishBatchAsync<TMessage>(string topic, IReadOnlyCollection<TMessage> messages)
        where TMessage : class
    {
        if (messages.Count == 0)
        {
            return;
        }

        try
        {
            var database = redisClient.GetDatabase();
            var values = messages.Select(message =>
                (RedisValue)JsonSerializer.Serialize(message, ReusableJsonSerializerOptions.Web)).ToArray();
            await database.ListRightPushAsync(topic, values);

            Log.MessageBatchPublished(logger, messages.Count, topic);
        }
        catch (Exception ex)
        {
            Log.ErrorPublishMessage(logger, ex);
        }
    }
}
