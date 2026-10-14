using Confluent.Kafka;
using Domain.Messages;
using Domain.Observability;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Infrastructure.MQ.Kafka;

public partial class KafkaMessageConsumer : BackgroundService
{
    private readonly IConsumer<Null, string> _consumer;
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<KafkaMessageConsumer> _logger;
    private readonly string[] _topics;
    private readonly WorkerObservability _observability = ServiceMeter.ForWorker(WorkerNames.KafkaConsumer);

    public KafkaMessageConsumer(
        ConsumerConfig config,
        IServiceProvider serviceProvider,
        ILogger<KafkaMessageConsumer> logger, 
        string[] topics)
    {
        _consumer = new ConsumerBuilder<Null, string>(config).Build();
        _serviceProvider = serviceProvider;
        _logger = logger;
        _topics = topics; 
    }

    protected override Task ExecuteAsync(CancellationToken stoppingToken)
    {
        // WorkerLoop.Run is load-bearing: it unwraps the inner loop task so the host observes the
        // loop's real lifetime and any exception escaping it. See WorkerLoop for what breaks
        // silently without it.
        return WorkerLoop.Run(() => StartConsumerLoop(stoppingToken));
    }

    private async Task StartConsumerLoop(CancellationToken cancellationToken)
    {
        ConsumeResult<Null, string>? consumeResult = null;
        var message = string.Empty;

        _observability.Started();

        try
        {
            _consumer.Subscribe(_topics);
            Log.StartConsuming(_logger, string.Join(", ", _topics));

            while (!cancellationToken.IsCancellationRequested)
            {
                // Every loop turn, including EOF and empty polls. This is the only signal that
                // distinguishes an idle topic from a consumer that has silently stopped.
                _observability.Heartbeat();

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

                    var topic = consumeResult.Topic;
                    if (string.IsNullOrWhiteSpace(topic))
                    {
                        continue;
                    }

                    // Root activity for this message. When the producer carried trace context on
                    // headers this continues that trace across the queue hop; when it did not, the
                    // context is default and the message starts its own trace as before.
                    using var activity = IngressActivity.StartConsume(
                        topic,
                        MessagingSystems.Kafka,
                        KafkaTraceContext.Extract(consumeResult.Message?.Headers));

                    using var scope = _serviceProvider.CreateScope();

                    var handler = scope.ServiceProvider.GetKeyedService<IMessageHandler>(consumeResult.Topic);
                    if (handler == null)
                    {
                        // M2: a topic being consumed with no registered handler is silent data loss.
                        MessagingMetrics.Current.RecordUnroutable(MessagingSystems.Kafka, consumeResult.Topic);
                        Log.NoHandlerForTopic(_logger, consumeResult.Topic);
                        continue;
                    }

                    // M2: measures handling only, not the blocking Consume() call above — otherwise an
                    // idle topic would report enormous "consume durations". Defaults to failure, so an
                    // exception escaping HandleAsync is recorded even though it is caught below.
                    using var consume = MessagingMetrics.Current.BeginConsume(MessagingSystems.Kafka, topic);

                    await handler.HandleAsync(message);

                    consume.Succeeded();
                    _observability.Success();
                }
                catch (ConsumeException ex)
                {
                    _observability.LoopFailed(ex);

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
                    _observability.LoopFailed(ex);
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
        catch (Exception ex)
        {
            // The host observes this task now, so anything escaping the loop stops the service.
            // Record it before it propagates, otherwise the only evidence is worker_running
            // dropping to zero with no reason attached.
            _observability.LoopFailed(ex);
            throw;
        }
        finally
        {
            _observability.Stopped();
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