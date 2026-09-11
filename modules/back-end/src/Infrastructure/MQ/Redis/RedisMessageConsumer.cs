using Domain.Messages;
using Domain.Observability;
using Infrastructure.Caches.Redis;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Infrastructure.MQ.Redis;

public partial class RedisMessageConsumer(
    IRedisClient redisClient,
    IServiceProvider serviceProvider,
    ILogger<RedisMessageConsumer> logger,
    string[] topics)
    : BackgroundService
{
    private readonly WorkerObservability _observability = ServiceMeter.ForWorker(WorkerNames.RedisConsumer);

    protected override Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var tasks = topics.Select(topic => ConsumeAsync(topic, stoppingToken));

        return Task.WhenAll(tasks);
    }

    public async Task ConsumeAsync(string topic, CancellationToken cancellationToken)
    {
        var redis = redisClient.GetDatabase();

        Log.StartConsuming(logger, topic);

        _observability.Started();

        try
        {
            while (!cancellationToken.IsCancellationRequested)
            {
                // Every poll, including the ones that find nothing. A fresh heartbeat with a stale
                // last_success is how an idle queue is told apart from a stopped consumer.
                _observability.Heartbeat();

                try
                {
                    // LPop json message from topic list
                    var rawMessage = await redis.ListLeftPopAsync(topic);
                    if (!rawMessage.HasValue)
                    {
                        // If the topic doesn't exist yet or there are no messages, delay the consumer by 1 second
                        await Task.Delay(1000, cancellationToken);
                        continue;
                    }

                    var message = rawMessage.ToString();

                    // Root activity for this message. When the payload carries trace context this
                    // continues the producer's trace; otherwise it starts a new trace as before.
                    using var activity = IngressActivity.StartConsume(
                        topic,
                        MessagingSystems.Redis,
                        JsonTraceContext.Extract(message));

                    using var scope = serviceProvider.CreateScope();
                    var sp = scope.ServiceProvider;

                    var handler = sp.GetKeyedService<IMessageHandler>(topic);
                    if (handler == null)
                    {
                        // A topic being consumed with no registered handler is silent data loss.
                        MessagingMetrics.Current.RecordUnroutable(MessagingSystems.Redis, topic);
                        Log.NoHandlerForTopic(logger, topic);
                        continue;
                    }

                    using var consume = MessagingMetrics.Current.BeginConsume(MessagingSystems.Redis, topic);

                    try
                    {
                        await handler.HandleAsync(message);
                        consume.Succeeded();
                        _observability.Success();
                        Log.MessageHandled(logger, message);
                    }
                    catch (Exception ex)
                    {
                        consume.Failed(ex);
                        Log.ErrorConsumeMessage(logger, message, ex);
                    }
                }
                catch (OperationCanceledException)
                {
                    // ignore
                }
                catch (Exception ex)
                {
                    _observability.LoopFailed(ex);
                    Log.ErrorConsumeTopic(logger, topic, ex);

                    // Exception occurred while consuming topic, delay consumer by 1 second
                    await Task.Delay(1000, cancellationToken);
                }
            }
        }
        finally
        {
            _observability.Stopped();
        }
    }
}