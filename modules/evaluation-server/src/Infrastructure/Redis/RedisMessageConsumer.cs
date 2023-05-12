using Domain.Core;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using StackExchange.Redis;

namespace Infrastructure.Redis;

public partial class RedisMessageConsumer : BackgroundService
{
    private readonly IConnectionMultiplexer _redis;
    private readonly Dictionary<string, IMqMessageHandler> _handlers;
    private readonly ILogger<RedisMessageConsumer> _logger;

    public RedisMessageConsumer(
        IConnectionMultiplexer redis,
        IEnumerable<IMqMessageHandler> handlers,
        ILogger<RedisMessageConsumer> logger)
    {
        _redis = redis;
        _handlers = handlers.ToDictionary(x => x.Topic, x => x);
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var consumer = _redis.GetSubscriber();

        // Subscribe Topics.FeatureFlagChange, Topics.SegmentChange
        var channels = new RedisChannel(Topics.DataChangePattern, RedisChannel.PatternMode.Pattern);
        var queue = await consumer.SubscribeAsync(channels);

        _logger.LogInformation(
            "Start consuming flag & segment change messages through channel {Channel}.",
            Topics.DataChangePattern
        );
        // process messages sequentially. ref: https://stackexchange.github.io/StackExchange.Redis/PubSubOrder.html
        queue.OnMessage(HandleMessageAsync);

        async Task HandleMessageAsync(ChannelMessage channelMessage)
        {
            var message = string.Empty;

            try
            {
                var channel = channelMessage.Channel;
                if (channel.IsNullOrEmpty)
                {
                    return;
                }

                var topic = channel.ToString();
                if (!_handlers.TryGetValue(topic, out var handler))
                {
                    Log.NoHandlerForTopic(_logger, topic);
                    return;
                }

                var value = channelMessage.Message;
                if (value.IsNullOrEmpty)
                {
                    return;
                }

                message = value.ToString();
                await handler.HandleAsync(message, stoppingToken);

                Log.MessageHandled(_logger, message);
            }
            catch (OperationCanceledException)
            {
                // ignore
            }
            catch (Exception ex)
            {
                Log.ErrorConsumeMessage(_logger, message, ex);
            }
        }
    }
}