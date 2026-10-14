using Domain.Messages;
using Domain.Observability;
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
    private readonly WorkerObservability _observability = ServiceMeter.ForWorker(WorkerNames.RedisConsumer);

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
        Log.StartConsumingDataChange(_logger, channel.ToString());
        queue.OnMessage(HandleMessageAsync);

        if (_useControlPlane)
        {
            var controlPlaneCommandChannel = RedisChannel.Literal(Topics.ControlPlaneCommand);
            var controlPlaneCommandQueue = await subscriber.SubscribeAsync(controlPlaneCommandChannel);

            Log.StartConsumingControlPlaneCommand(_logger, controlPlaneCommandChannel.ToString());
            controlPlaneCommandQueue.OnMessage(HandleMessageAsync);
        }

        // This consumer is push-based, so unlike the polling consumers there is no loop to
        // heartbeat from. "Running" therefore means "subscribed", and the heartbeat advances per
        // delivered message. A silent Redis and a healthy-but-idle Redis look the same here; that
        // is a property of pub/sub, and pretending otherwise would be worse than admitting it.
        _observability.Started();

        return;

        async Task HandleMessageAsync(ChannelMessage channelMessage)
        {
            var message = string.Empty;

            _observability.Heartbeat();

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
                    // M2: a topic nothing here handles is silent data loss; counting it makes it
                    // alertable rather than a log line nobody reads.
                    MessagingMetrics.Current.RecordUnroutable(MessagingSystems.Redis, topic);
                    Log.NoHandlerForTopic(_logger, topic);
                    return;
                }

                var value = channelMessage.Message;
                if (value.IsNullOrEmpty)
                {
                    return;
                }

                message = value.ToString();

                // Continue the producer's trace when the payload carried one; otherwise start the
                // root activity that lets logs from this handler be correlated.
                using var activity = IngressActivity.StartConsume(
                    topic,
                    MessagingSystems.Redis,
                    JsonTraceContext.Extract(message));

                // M2: defaults to failure, so an exception escaping HandleAsync is recorded even
                // though it is caught below.
                using var consume = MessagingMetrics.Current.BeginConsume(MessagingSystems.Redis, topic);

                await handler.HandleAsync(message, stoppingToken);

                consume.Succeeded();
                _observability.Success();
                Log.MessageHandled(_logger, message);
            }
            catch (OperationCanceledException)
            {
                // ignore
            }
            catch (Exception ex)
            {
                _observability.LoopFailed(ex);
                Log.ErrorConsumeMessage(_logger, message, ex);
            }
        }
    }

    public override async Task StopAsync(CancellationToken cancellationToken)
    {
        _observability.Stopped();
        await base.StopAsync(cancellationToken);
    }
}