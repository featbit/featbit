using Domain.Messages;
using Infrastructure.AppService;
using Infrastructure.Redis;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Infrastructure.MQ.Redis;

public partial class RedisMessageConsumer : BackgroundService
{
    private readonly IRedisClient _redis;
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<RedisMessageConsumer> _logger;

    public RedisMessageConsumer(
        IRedisClient redis,
        IServiceProvider serviceProvider,
        ILogger<RedisMessageConsumer> logger)
    {
        _redis = redis;
        _serviceProvider = serviceProvider;
        _logger = logger;
    }

    protected override Task ExecuteAsync(CancellationToken stoppingToken)
    {
        // eager resolve InsightsWriter to start flushing insights loop
        _ = _serviceProvider.GetRequiredService<InsightsWriter>();

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

        _logger.LogInformation("Start consuming {Topic} messages...", topic);

        while (!cancellationToken.IsCancellationRequested)
        {
            try
            {
                // LPop json message from topic list
                var rawMessage = await db.ListLeftPopAsync(topic);
                if (!rawMessage.HasValue)
                {
                    // If the topic doesn't exist yet or there are no messages, delay the consumer by 1 second
                    await Task.Delay(1000, cancellationToken);
                    continue;
                }

                using var scope = _serviceProvider.CreateScope();
                var sp = scope.ServiceProvider;

                var handler = topic switch
                {
                    Topics.EndUser => sp.GetRequiredKeyedService<IMessageHandler>(nameof(EndUserMessageHandler)),
                    Topics.Insights => sp.GetRequiredKeyedService<IMessageHandler>(nameof(InsightMessageHandler)),
                    _ => null
                };
                if (handler == null)
                {
                    Log.NoHandlerForTopic(_logger, topic);
                    continue;
                }

                var message = rawMessage.ToString();
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
            catch (OperationCanceledException)
            {
                // ignore
            }
            catch (Exception ex)
            {
                Log.ErrorConsumeTopic(_logger, topic, ex);

                // Exception occurred while consuming topic, delay consumer by 1 second
                await Task.Delay(1000, cancellationToken);
            }
        }
    }
}