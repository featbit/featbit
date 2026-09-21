using System.Diagnostics;
using System.Text.Json;
using Domain.Messages;
using Domain.Observability;
using Domain.Shared;
using Infrastructure.Caches.Redis;
using Microsoft.Extensions.Logging;
using StackExchange.Redis;

namespace Infrastructure.MQ.Redis;

public partial class RedisMessageProducer(IRedisClient redisClient, ILogger<RedisMessageProducer> logger)
    : IMessageProducer
{
    private const int MaxBatchSize = 100;

    public async Task PublishAsync<TMessage>(string topic, TMessage? message) where TMessage : class
    {
        // M2: instrumented at the adapter. The exception below is swallowed (unchanged behavior),
        // so counting the failure here is the only way it becomes visible.
        using var publish = MessagingMetrics.Current.BeginPublish(MessagingSystems.Redis, topic);

        try
        {
            var jsonMessage = JsonSerializer.Serialize(message, ReusableJsonSerializerOptions.Web);
            jsonMessage = JsonTraceContext.Inject(jsonMessage, Activity.Current);

            // RPush json message to topic list
            await redisClient.GetDatabase().ListRightPushAsync(topic, jsonMessage);

            publish.Enqueued();
            Log.MessagePublished(logger, jsonMessage);
        }
        catch (Exception ex)
        {
            publish.Failed(ex);
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
            if (messages.Count <= MaxBatchSize)
            {
                // hot path
                await PublishBatchCoreAsync(database, messages);
            }
            else
            {
                foreach (var batch in messages.Chunk(MaxBatchSize))
                {
                    await PublishBatchCoreAsync(database, batch);
                }
            }

            Log.MessageBatchPublished(logger, messages.Count, topic);
        }
        catch (Exception ex)
        {
            Log.ErrorPublishMessage(logger, ex);
        }

        return;

        Task PublishBatchCoreAsync(IDatabase redis, IReadOnlyCollection<TMessage> batch)
        {
            var values = batch.Select(message =>
                (RedisValue)JsonSerializer.Serialize(message, ReusableJsonSerializerOptions.Web)
            ).ToArray();

            return redis.ListRightPushAsync(topic, values);
        }
    }
}
