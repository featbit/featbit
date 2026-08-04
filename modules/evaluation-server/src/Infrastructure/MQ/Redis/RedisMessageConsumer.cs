using Domain.Messages;
using Infrastructure.Caches.Redis;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using StackExchange.Redis;

namespace Infrastructure.MQ.Redis;

public partial class RedisMessageConsumer : BackgroundService
{
    private readonly IRedisClient _redisClient;
    private readonly Dictionary<string, IMessageConsumer> _handlers;
    private readonly ILogger<RedisMessageConsumer> _logger;
    private readonly bool _useControlPlane;

    public RedisMessageConsumer(
        IRedisClient redisClient,
        IConfiguration configuration,
        IEnumerable<IMessageConsumer> handlers,
        ILogger<RedisMessageConsumer> logger)
    {
        _redisClient = redisClient;
        _useControlPlane = configuration.UseControlPlane();
        _handlers = handlers.ToDictionary(x => x.Topic, x => x);
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var subscriber = _redisClient.GetSubscriber();

        // Always subscribe to pattern-based data changes.
        var channel = new RedisChannel(Topics.DataChangePattern, RedisChannel.PatternMode.Pattern);
        var queue = await subscriber.SubscribeAsync(channel);

        // process messages sequentially. ref: https://stackexchange.github.io/StackExchange.Redis/PubSubOrder.html
        _logger.LogInformation(
            "Start consuming flag & segment change messages through channel {Channel}.",
            channel.ToString()
        );
        queue.OnMessage(HandleMessageAsync);

        if (_useControlPlane)
        {
            var controlPlaneCommandChannel = RedisChannel.Literal(Topics.ControlPlaneCommand);
            var controlPlaneCommandQueue = await subscriber.SubscribeAsync(controlPlaneCommandChannel);

            _logger.LogInformation(
                "Start consuming control plane command messages through channel {ControlPlaneChannel}.",
                controlPlaneCommandChannel.ToString()
            );
            controlPlaneCommandQueue.OnMessage(HandleMessageAsync);
        }

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