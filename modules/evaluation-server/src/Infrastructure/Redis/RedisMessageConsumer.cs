using Domain.Messages;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using StackExchange.Redis;

namespace Infrastructure.Redis;

public partial class RedisMessageConsumer : BackgroundService
{
    private readonly ISubscriber _subscriber;
    private readonly Dictionary<string, IMessageConsumer> _handlers;
    private readonly ILogger<RedisMessageConsumer> _logger;

    public RedisMessageConsumer(
        IRedisClient redisClient,
        IEnumerable<IMessageConsumer> handlers,
        ILogger<RedisMessageConsumer> logger)
    {
        _subscriber = redisClient.GetSubscriber();
        _handlers = handlers.ToDictionary(x => x.Topic, x => x);
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        // Subscribe Topics.FeatureFlagChange, Topics.SegmentChange
        var channel = new RedisChannel(Topics.DataChangePattern, RedisChannel.PatternMode.Pattern);
        var queue = await _subscriber.SubscribeAsync(channel);

        _logger.LogInformation(
            "Start consuming flag & segment change messages through channel {Channel}.",
            channel.ToString()
        );
        // process messages sequentially. ref: https://stackexchange.github.io/StackExchange.Redis/PubSubOrder.html
        queue.OnMessage(HandleMessageAsync);
        return;

        async Task HandleMessageAsync(ChannelMessage channelMessage)
        {
            var message = string.Empty;

            try
            {
                var theChannel = channelMessage.Channel;
                if (theChannel.IsNullOrEmpty)
                {
                    return;
                }

                var topic = theChannel.ToString();
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