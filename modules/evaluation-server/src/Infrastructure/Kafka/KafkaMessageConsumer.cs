using Confluent.Kafka;
using Domain.Core;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Infrastructure.Kafka;

public partial class KafkaMessageConsumer : BackgroundService
{
    private readonly ILogger<KafkaMessageConsumer> _logger;
    private readonly IConsumer<Null, string> _consumer;
    private readonly IEnumerable<IKafkaMessageHandler> _messageHandlers;

    public KafkaMessageConsumer(
        IConfiguration configuration,
        ILogger<KafkaMessageConsumer> logger,
        IEnumerable<IKafkaMessageHandler> messageHandlers)
    {
        _logger = logger;
        _messageHandlers = messageHandlers;

        ConsumerConfig config = new()
        {
            GroupId = "evaluation-server",
            BootstrapServers = configuration["Kafka:BootstrapServers"],

            // read messages from start if no commit exists
            AutoOffsetReset = AutoOffsetReset.Earliest,

            // at least once delivery semantics
            // https://docs.confluent.io/kafka-clients/dotnet/current/overview.html#store-offsets
            EnableAutoCommit = true,
            AutoCommitIntervalMs = 5000,
            // disable auto-store of offsets
            EnableAutoOffsetStore = false
        };

        _consumer = new ConsumerBuilder<Null, string>(config).Build();
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

        while (!cancellationToken.IsCancellationRequested)
        {
            try
            {
                var consumeResult = _consumer.Consume(cancellationToken);
                if (consumeResult.IsPartitionEOF)
                {
                    continue;
                }

                var handler = _messageHandlers.FirstOrDefault(x => x.Topic == consumeResult.Topic);
                if (handler == null)
                {
                    Log.NoHandlerForTopic(_logger, consumeResult.Topic);
                    continue;
                }

                await handler.HandleAsync(consumeResult, cancellationToken);
            }
            catch (ConsumeException ex)
            {
                Log.FailedConsumeMessage(_logger, ex.Error.ToString());

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
                Log.ErrorConsumeMessage(_logger, ex);
            }
        }
    }

    public override void Dispose()
    {
        _consumer.Unsubscribe();
        _consumer.Close();
        _consumer.Dispose();

        base.Dispose();
    }
}