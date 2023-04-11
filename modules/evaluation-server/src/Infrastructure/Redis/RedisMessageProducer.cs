using System.Text.Json;
using Domain.Core;
using Microsoft.Extensions.Logging;
using StackExchange.Redis;

namespace Infrastructure.Redis;

public partial class RedisMessageProducer : IMqMessageProducer
{
    private readonly IDatabase _database;
    private readonly ILogger<RedisMessageProducer> _logger;

    public RedisMessageProducer(IConnectionMultiplexer redis, ILogger<RedisMessageProducer> logger)
    {
        _database = redis.GetDatabase();
        _logger = logger;
    }

    public async Task PublishAsync<TMessage>(string topic, TMessage? message) where TMessage : class
    {
        try
        {
            var jsonMessage = JsonSerializer.Serialize(message, ReusableJsonSerializerOptions.Web);

            // RPush json message to topic list
            await _database.ListRightPushAsync(topic, jsonMessage);

            Log.MessagePublished(_logger, jsonMessage);
        }
        catch (Exception ex)
        {
            Log.ErrorPublishMessage(_logger, ex);
        }
    }
}