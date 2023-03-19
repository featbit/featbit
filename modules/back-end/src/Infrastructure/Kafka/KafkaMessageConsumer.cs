using System.Text.Json;
using Confluent.Kafka;
using Domain.EndUsers;
using Domain.Messages;
using Domain.Utils;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Infrastructure.Kafka;

public partial class KafkaMessageConsumer : BackgroundService
{
    private readonly IConsumer<Null, string> _consumer;
    private readonly IEndUserService _service;
    private readonly ILogger<KafkaMessageConsumer> _logger;

    public KafkaMessageConsumer(
        IEndUserService service,
        IConfiguration configuration,
        ILogger<KafkaMessageConsumer> logger)
    {
        _service = service;
        _logger = logger;

        ConsumerConfig config = new()
        {
            GroupId = "api",
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
        _consumer.Subscribe(Topics.EndUser);

        ConsumeResult<Null, string>? consumeResult = null;
        var message = string.Empty;
        while (!cancellationToken.IsCancellationRequested)
        {
            try
            {
                consumeResult = _consumer.Consume(cancellationToken);
                if (consumeResult.IsPartitionEOF)
                {
                    continue;
                }

                message = consumeResult.Message.Value;
                if (string.IsNullOrWhiteSpace(message))
                {
                    continue;
                }

                var endUserMessage =
                    JsonSerializer.Deserialize<EndUserMessage>(message, ReusableJsonSerializerOptions.Web);
                if (endUserMessage == null)
                {
                    continue;
                }

                // upsert endUser and it's properties
                var endUser = endUserMessage.AsEndUser();
                await _service.UpsertAsync(endUser);
                await _service.AddNewPropertiesAsync(endUser);
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