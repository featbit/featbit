using System.Text.Json;
using Confluent.Kafka;
using Domain.EndUsers;
using Domain.Messages;
using Domain.Utils;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Infrastructure.HostedServices;

public partial class KafkaConsumerService : BackgroundService
{
    private readonly IConsumer<Null, string> _consumer;
    private readonly IEndUserService _service;
    private readonly ILogger<KafkaConsumerService> _logger;

    public KafkaConsumerService(
        IEndUserService service,
        IConfiguration configuration,
        ILogger<KafkaConsumerService> logger)
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

        while (!cancellationToken.IsCancellationRequested)
        {
            try
            {
                var consumeResult = _consumer.Consume(cancellationToken);
                if (consumeResult.IsPartitionEOF)
                {
                    continue;
                }

                var value = consumeResult.Message.Value;
                if (string.IsNullOrWhiteSpace(value))
                {
                    continue;
                }

                var message = JsonSerializer.Deserialize<EndUserMessage>(value, ReusableJsonSerializerOptions.Web);
                if (message == null)
                {
                    continue;
                }

                // upsert endUser and it's properties
                var endUser = message.AsEndUser();
                await _service.UpsertAsync(endUser);
                await _service.AddNewPropertiesAsync(endUser);

                // store offset manually
                _consumer.StoreOffset(consumeResult);

                // wait 150ms
                await Task.Delay(150, cancellationToken);
            }
            catch (ConsumeException ex)
            {
                var error = ex.Error.ToString();
                Log.FailedConsumeMessage(_logger, error);

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