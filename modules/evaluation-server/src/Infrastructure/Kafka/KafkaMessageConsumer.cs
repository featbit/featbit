using Confluent.Kafka;
using Domain.Messages;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Infrastructure.Kafka;

public partial class KafkaMessageConsumer : BackgroundService
{
    private readonly IConsumer<Null, string> _consumer;
    private readonly Dictionary<string, IMessageConsumer> _handlers;
    private readonly ILogger<KafkaMessageConsumer> _logger;

    public KafkaMessageConsumer(
        ConsumerConfig config,
        IEnumerable<IMessageConsumer> handlers,
        ILogger<KafkaMessageConsumer> logger)
    {
        _handlers = handlers.ToDictionary(x => x.Topic, x => x);

        config.GroupId = $"evaluation-server-{Guid.NewGuid()}";
        _consumer = new ConsumerBuilder<Null, string>(config).Build();

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
        var topics = new[] { Topics.FeatureFlagChange, Topics.SegmentChange };

        _consumer.Subscribe(topics);
        _logger.LogInformation(
            "Start consuming flag & segment change messages through topics: {Topics}.",
            string.Join(',', topics)
        );

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