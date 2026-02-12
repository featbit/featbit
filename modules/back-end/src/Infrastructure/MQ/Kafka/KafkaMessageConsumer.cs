using System.Text.Json;
using Confluent.Kafka;
using Domain.EndUsers;
using Domain.Messages;
using Domain.Utils;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Infrastructure.MQ.Kafka;

public partial class KafkaMessageConsumer : BackgroundService
{
    private readonly IConsumer<Null, string> _consumer;
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<KafkaMessageConsumer> _logger;
    private readonly IEnumerable<IMessageConsumer> _messageConsumers;

    //TODO: MOdify this to be able to handle multiple message consumers
    //TODO: For now assume that we will handle all of the messages so add the topics to the subscribelist.
    //Long term we need to consider multiple types of consumers such as redis or postgres and give us the ability to specify which topics they will consume.
    public KafkaMessageConsumer(
        ConsumerConfig config,
        IServiceProvider serviceProvider,
        IEnumerable<IMessageConsumer> messageConsumers,
        ILogger<KafkaMessageConsumer> logger)
    {
        _consumer = new ConsumerBuilder<Null, string>(config).Build();
        _serviceProvider = serviceProvider;
        _logger = logger;
        _messageConsumers = messageConsumers;
    }

    protected override Task ExecuteAsync(CancellationToken stoppingToken)
    {
        return Task.Factory.StartNew(
            async () => { await StartConsumerLoop(stoppingToken); },
            TaskCreationOptions.LongRunning
        );
    }

    private async Task StartConsumerLoop(CancellationToken cancellationToken)
    {
        _consumer.Subscribe([Topics.EndUser, Topics.ConnectionMade]);
        _logger.LogInformation("Start consuming {Topic} messages...", Topics.EndUser);

        ConsumeResult<Null, string>? consumeResult = null;
        var message = string.Empty;
        while (!cancellationToken.IsCancellationRequested)
        {
            try
            {
                consumeResult = _consumer.Consume(cancellationToken);
                if (consumeResult.IsPartitionEOF)
                {
                    // reached end of topic
                    continue;
                }

                var handler = _messageConsumers.FirstOrDefault(x => x.Topic == consumeResult.Topic);
                if (handler == null)
                {
                    //Log.NoHandlerForTopic(_logger, consumeResult.Topic);
                    Console.WriteLine($"No handler for topic {consumeResult.Topic}");
                    continue;
                }

                message = consumeResult.Message == null ? string.Empty : consumeResult.Message.Value;
                await handler.HandleAsync(message, cancellationToken);
            }
            catch (ConsumeException ex)
            {
                var error = ex.Error.ToString();
                Log.FailedConsumeMessage(_logger, message, error);

                if (ex.Error.IsFatal)
                {
                    // https://github.com/edenhill/librdkafka/blob/master/INTRODUCTION.md#fatal-consumer-errors
                    break;
                }
            }
            catch (OperationCanceledException)
            {
                // ignore
            }
            catch (Exception ex)
            {
                Log.ErrorConsumeMessage(_logger, message, ex);
            }
            finally
            {
                try
                {
                    if (consumeResult != null)
                    {
                        // store offset manually
                        _consumer.StoreOffset(consumeResult);
                    }
                }
                catch (Exception ex)
                {
                    Log.ErrorStoreOffset(_logger, ex);
                }
            }
        }
    }

    public override void Dispose()
    {
        // Commit offsets and leave the group cleanly.
        _consumer.Close();
        _consumer.Dispose();

        base.Dispose();
    }
}