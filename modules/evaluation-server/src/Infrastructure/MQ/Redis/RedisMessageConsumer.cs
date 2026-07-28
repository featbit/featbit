using Domain.Messages;
using Infrastructure.Caches.Redis;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using StackExchange.Redis;

namespace Infrastructure.MQ.Redis;

public partial class RedisMessageConsumer : BackgroundService
{
    private readonly IRedisClient _redisClient;
    private readonly Dictionary<string, IMessageConsumer> _handlers;
    private readonly ILogger<RedisMessageConsumer> _logger;

    public RedisMessageConsumer(
        IRedisClient redisClient,
        IEnumerable<IMessageConsumer> handlers,
        ILogger<RedisMessageConsumer> logger)
    {
        _redisClient = redisClient;
        _handlers = handlers.ToDictionary(x => x.Topic, x => x);
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var subscriber = _redisClient.GetSubscriber();

        // Subscribe to both the pattern-based data changes and the explicit control-plane command topic
        var dataChangeChannel = new RedisChannel(Topics.DataChangePattern, RedisChannel.PatternMode.Pattern);
        var controlPlaneCommandChannel = new RedisChannel(Topics.ControlPlaneCommand, RedisChannel.PatternMode.Literal);

        var dataChangeQueue = await subscriber.SubscribeAsync(dataChangeChannel);
        var controlPlaneCommandQueue = await subscriber.SubscribeAsync(controlPlaneCommandChannel);

        _logger.LogInformation(
            "Start consuming flag & segment change messages through channel {Channel}, and control plane command messages through channel {ControlPlaneChannel}.",
            dataChangeChannel.ToString(),
            controlPlaneCommandChannel.ToString()
        );

        // process messages sequentially. ref: https://stackexchange.github.io/StackExchange.Redis/PubSubOrder.html
        dataChangeQueue.OnMessage(HandleMessageAsync);
        controlPlaneCommandQueue.OnMessage(HandleMessageAsync);

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