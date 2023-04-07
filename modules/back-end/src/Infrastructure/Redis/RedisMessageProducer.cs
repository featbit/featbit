using System.Text.Json;
using Domain.Messages;
using Domain.Utils;
using Microsoft.Extensions.Logging;
using StackExchange.Redis;

namespace Infrastructure.Redis;

public partial class RedisMessageProducer : IMessageProducer
{
    private readonly IDatabase _database;
    private readonly ILogger<RedisMessageProducer> _logger;

    public RedisMessageProducer(IRedisClient redis, ILogger<RedisMessageProducer> logger)
    {
        _database = redis.GetDatabase();
        _logger = logger;
    }

    public async Task PublishAsync<TMessage>(string topic, TMessage message) where TMessage : class
    {
        try
        {
            var jsonMessage = JsonSerializer.Serialize(message, ReusableJsonSerializerOptions.Web);

            // Publish message to topic
            await _database.PublishAsync(topic, jsonMessage);

            Log.MessagePublished(_logger, jsonMessage);
        }
        catch (Exception ex)
        {
            Log.ErrorPublishMessage(_logger, ex);
        }
    }
}