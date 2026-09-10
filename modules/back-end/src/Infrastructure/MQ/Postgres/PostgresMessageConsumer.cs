using System.Data;
using Dapper;
using Domain.Messages;
using Domain.Observability;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Npgsql;

namespace Infrastructure.MQ.Postgres;

public partial class PostgresMessageConsumer(
    IServiceScopeFactory scopeFactory,
    NpgsqlDataSource dataSource,
    ILogger<PostgresMessageConsumer> logger,
    string[] topics)
    : BackgroundService
{
    private readonly WorkerObservability _observability = ServiceMeter.ForWorker(WorkerNames.PostgresConsumer);

    private const int PollBatchSize = 100;
    private const int PollIntervalInSeconds = 3;
    private const int RetryIntervalInSeconds = 5;

    private const string FetchSql =
        $"""
         with available_messages as (
             select id
             from queue_messages
             where (not_visible_until is null or (not_visible_until <= now())) 
                 and topic = @Topic
                 and status = '{QueueMessageStatus.Pending}'
             order by id asc
             limit @BatchSize
             for update skip locked
         )
         update queue_messages qm
         set status = '{QueueMessageStatus.Processing}', 
             not_visible_until = now() + interval '1 minute',
             deliver_count = deliver_count + 1,
             last_deliver_at = now()
         from available_messages am
         where qm.id = am.id
         returning qm.id, qm.payload, qm.deliver_count
         """;

    protected override Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var tasks = topics.Select(topic => ProcessAsync(topic, stoppingToken));

        return Task.WhenAll(tasks);
    }

    private async Task ProcessAsync(string topic, CancellationToken stoppingToken)
    {
        Log.StartConsumingTopic(logger, topic);

        _observability.Started();

        try
        {
            while (!stoppingToken.IsCancellationRequested)
            {
                // Every poll, including empty ones. A fresh heartbeat with a stale last_success
                // distinguishes "no messages to consume" from "the consumer has stopped".
                _observability.Heartbeat();

                try
                {
                    // poll messages
                    var messages = await PollAsync(topic, stoppingToken);
                    Log.MessagePolled(logger, topic, messages.Count);

                    // handle messages
                    await HandleMessagesAsync(topic, messages, stoppingToken);

                    _observability.Success();

                    // if messages are less than batch size, delay consumer by PollIntervalInSeconds
                    if (messages.Count < PollBatchSize)
                    {
                        Log.WaitForNextPoll(logger, PollIntervalInSeconds, messages.Count, PollBatchSize);
                        await Task.Delay(TimeSpan.FromSeconds(PollIntervalInSeconds), stoppingToken);
                    }
                }
                catch (OperationCanceledException)
                {
                    // ignore
                }
                catch (Exception ex)
                {
                    _observability.LoopFailed(ex);
                    Log.ErrorConsumeTopic(logger, topic, RetryIntervalInSeconds, ex);

                    // Exception occurred while consuming topic, retry after RetryIntervalInSeconds
                    await Task.Delay(TimeSpan.FromSeconds(RetryIntervalInSeconds), stoppingToken);
                }
            }
        }
        finally
        {
            _observability.Stopped();
        }
    }

    private async Task<List<(long id, string payload, int deliver_count)>> PollAsync(
        string topic,
        CancellationToken stoppingToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(stoppingToken);

        await using var transaction =
            await connection.BeginTransactionAsync(IsolationLevel.ReadCommitted, stoppingToken);

        var messages = await connection.QueryAsync<(long id, string payload, int deliver_count)>(
            FetchSql, new { Topic = topic, BatchSize = PollBatchSize }
        );

        await transaction.CommitAsync(stoppingToken);

        var polled = messages.AsList();

        // deliver_count is incremented by the poll itself, so anything above 1 means an earlier
        // attempt claimed this message and never completed it — a crash, or a handler that outran
        // the one-minute visibility window. That work is about to be repeated.
        var redelivered = polled.Count(x => x.deliver_count > 1);
        MessagingMetrics.Current.RecordRedelivered(MessagingSystems.Postgres, topic, redelivered);

        return polled;
    }

    private async Task HandleMessagesAsync(
        string topic,
        List<(long id, string payload, int deliver_count)> messages,
        CancellationToken stoppingToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(stoppingToken);
        foreach (var (id, payload, _) in messages)
        {
            var error = await HandleAsync(payload);
            await MarkAsProcessed(connection, id, error);
        }

        return;

        async Task<string> HandleAsync(string payload)
        {
            // Root activity for this message: a consumed message has no ambient activity, so
            // without one nothing logged while handling it can be correlated.
            using var activity = IngressActivity.StartConsume(topic, MessagingSystems.Postgres);

            var handler = scopeFactory.CreateScope()
                .ServiceProvider
                .GetKeyedService<IMessageHandler>(topic);

            if (handler is null)
            {
                MessagingMetrics.Current.RecordUnroutable(MessagingSystems.Postgres, topic);
                Log.NoHandlerForTopic(logger, topic);
                return $"No handler for topic: {topic}";
            }

            using var consume = MessagingMetrics.Current.BeginConsume(MessagingSystems.Postgres, topic);

            try
            {
                await handler.HandleAsync(payload);
                consume.Succeeded();
                Log.MessageHandled(logger, payload);

                return string.Empty;
            }
            catch (Exception ex)
            {
                consume.Failed(ex);
                Log.ErrorConsumeMessage(logger, payload, ex);
                return ex.Message;
            }
        }

        async Task MarkAsProcessed(NpgsqlConnection conn, long id, string error)
        {
            var status = string.IsNullOrWhiteSpace(error)
                ? QueueMessageStatus.Completed
                : QueueMessageStatus.Failed;

            if (status == QueueMessageStatus.Completed)
            {
                await conn.ExecuteAsync(
                    "delete from queue_messages where id = @Id",
                    new { Id = id }
                );
            }
            else
            {
                await conn.ExecuteAsync(
                    "update queue_messages set status = @Status, last_handled_at = now(), error = @Error where id = @Id",
                    new { Status = status, Error = error, Id = id }
                );
            }

            Log.MessageProcessed(logger, id, status, error);
        }
    }
}