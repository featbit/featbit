using Confluent.Kafka;
using Domain.Messages;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Infrastructure.Kafka;

public partial class KafkaMessageConsumer : BackgroundService
{
    private readonly IConsumer<Null, string> _consumer;
    private readonly Dictionary<string, IMessageHandler> _handlers;
    private readonly ILogger<KafkaMessageConsumer> _logger;

    public KafkaMessageConsumer(
        ConsumerConfig config,
        IEnumerable<IMessageHandler> handlers,
        ILogger<KafkaMessageConsumer> logger)
    {
        _consumer = new ConsumerBuilder<Null, string>(config).Build();
        _handlers = handlers.ToDictionary(x => x.Topic, x => x);
        _logger = logger;
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
        _consumer.Subscribe(Topics.EndUser);
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

                var topic = consumeResult.Topic;
                if (!_handlers.TryGetValue(topic, out var handler))
                {
                    Log.NoHandlerForTopic(_logger, topic);
                    continue;
                }

                message = consumeResult.Message == null ? string.Empty : consumeResult.Message.Value;
                await handler.HandleAsync(message, cancellationToken);

                Log.MessageHandled(_logger, message);
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