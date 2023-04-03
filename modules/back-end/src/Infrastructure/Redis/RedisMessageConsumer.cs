using Domain.Messages;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using StackExchange.Redis;

namespace Infrastructure.Redis;

public partial class RedisMessageConsumer : BackgroundService
{
    private readonly IConnectionMultiplexer _redis;
    private readonly Dictionary<string, IMessageHandler> _handlers;
    private readonly ILogger<RedisMessageConsumer> _logger;

    public RedisMessageConsumer(
        IConnectionMultiplexer redis,
        IEnumerable<IMessageHandler> handlers,
        ILogger<RedisMessageConsumer> logger)
    {
        _redis = redis;
        _handlers = handlers.ToDictionary(x => x.Topic, x => x);
        _logger = logger;
    }

    protected override Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var tasks = new[]
        {
            ConsumeAsync(Topics.EndUser, stoppingToken),
            ConsumeAsync(Topics.Insights, stoppingToken)
        };

        return Task.WhenAll(tasks);
    }

    public async Task ConsumeAsync(string topic, CancellationToken cancellationToken)
    {
        var db = _redis.GetDatabase();

        while (!cancellationToken.IsCancellationRequested)
        {
            try
            {
                // LPop json message from topic list
                var rawMessages = await db.ListLeftPopAsync(topic, 100);
                if (rawMessages.Length == 0)
                {
                    // If there is no message, delay consumer by 1 second
                    await Task.Delay(1000, cancellationToken);
                    return;
                }

                if (!_handlers.TryGetValue(topic, out var handler))
                {
                    Log.NoHandlerForTopic(_logger, topic);
                    return;
                }

                for (var i = 0; i < rawMessages.Length; i++)
                {
                    var message = rawMessages[i].ToString();

                    try
                    {
                        await handler.HandleAsync(message, cancellationToken);
                        Log.MessageHandled(_logger, message);
                    }
                    catch (Exception ex)
                    {
                        Log.ErrorConsumeMessage(_logger, message, ex);
                    }
                }
            }
            catch (OperationCanceledException)
            {
                // ignore
            }
            catch (Exception ex)
            {
                Log.ErrorConsumeTopic(_logger, topic, ex);
            }
        }
    }
}