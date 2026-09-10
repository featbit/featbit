using Confluent.Kafka;
using Domain.Messages;
using Domain.Observability;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Infrastructure.MQ.Kafka;

public partial class KafkaMessageConsumer : BackgroundService
{
    private readonly ILogger<KafkaMessageConsumer> _logger;
    private readonly IConsumer<Null, string> _consumer;
    private readonly IEnumerable<IMessageConsumer> _messageHandlers;
    private readonly string[] _topics;
    private readonly WorkerObservability _observability = ServiceMeter.ForWorker(WorkerNames.KafkaConsumer);

    public KafkaMessageConsumer(
        ConsumerConfig config,
        IConfiguration configuration,
        ILogger<KafkaMessageConsumer> logger,
        IEnumerable<IMessageConsumer> messageHandlers)
    {
        _logger = logger;
        _messageHandlers = messageHandlers;

        config.GroupId = $"evaluation-server-{Guid.NewGuid()}";
        _consumer = new ConsumerBuilder<Null, string>(config).Build();

        // Same list the backlog probe reports lag for, so a topic can never be consumed without
        // being watched.
        _topics = KafkaConsumerTopics.For(configuration);
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
            _logger.LogInformation(
                "Start consuming messages through topics: {Topics}.",
                string.Join(',', _topics)
            );

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
                        // reached end of topic
                        continue;
                    }

                    var handler = _messageHandlers.FirstOrDefault(x => x.Topic == consumeResult.Topic);
                    if (handler == null)
                    {
                        // M2: a topic being published that nothing here handles is a silent data loss,
                        // and today it is only a log line. Counting it makes it alertable.
                        MessagingMetrics.Current.RecordUnroutable(MessagingSystems.Kafka, consumeResult.Topic);
                        Log.NoHandlerForTopic(_logger, consumeResult.Topic);
                        continue;
                    }

                    message = consumeResult.Message == null ? string.Empty : consumeResult.Message.Value;

                    // Root activity for this message. When the producer carried trace context on
                    // headers this continues that trace across the queue hop; when it did not, the
                    // context is default and the message starts its own trace as before.
                    using var activity = IngressActivity.StartConsume(
                        consumeResult.Topic,
                        MessagingSystems.Kafka,
                        KafkaTraceContext.Extract(consumeResult.Message?.Headers));

                    // M2: measures handling only, not the blocking Consume() call above — otherwise an
                    // idle topic would report enormous "consume durations". The scope defaults to
                    // failure, so an exception escaping HandleAsync is recorded even though it is
                    // caught below.
                    using var consume = MessagingMetrics.Current.BeginConsume(
                        MessagingSystems.Kafka, consumeResult.Topic);

                    await handler.HandleAsync(message, cancellationToken);

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