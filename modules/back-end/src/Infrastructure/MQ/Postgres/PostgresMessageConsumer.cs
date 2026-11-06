using System.Data;
using Dapper;
using Domain.Messages;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Npgsql;

namespace Infrastructure.MQ.Postgres;

public partial class PostgresMessageConsumer(
    IServiceScopeFactory scopeFactory,
    NpgsqlDataSource dataSource,
    ILogger<PostgresMessageConsumer> logger,
    string[] topics,
    TimeProvider? timeProvider = null)
    : BackgroundService
{
    private const int PollBatchSize = 100;
    private const int PollIntervalInSeconds = 3;
    private const int RetryIntervalInSeconds = 5;
    private readonly TimeProvider _timeProvider = timeProvider ?? TimeProvider.System;

    private const string FetchSql =
        $"""
         with available_messages as (
             select id
             from queue_messages
             where (not_visible_until is null or (not_visible_until <= now())) 
                 and topic = @Topic
                 and status in ('{QueueMessageStatus.Pending}', '{QueueMessageStatus.Processing}')
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
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                // poll messages
                var messages = await PollAsync(topic, stoppingToken);
                Log.MessagePolled(logger, topic, messages.Count);

                // handle messages
                await HandleMessagesAsync(topic, messages, stoppingToken);

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
                Log.ErrorConsumeTopic(logger, topic, RetryIntervalInSeconds, ex);

                // Exception occurred while consuming topic, retry after RetryIntervalInSeconds
                await Task.Delay(TimeSpan.FromSeconds(RetryIntervalInSeconds), stoppingToken);
            }
        }
    }

    internal async Task<List<(long id, string payload, int deliveryCount)>> PollAsync(string topic, CancellationToken stoppingToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(stoppingToken);

        await using var transaction =
            await connection.BeginTransactionAsync(IsolationLevel.ReadCommitted, stoppingToken);

        var messages = await connection.QueryAsync<(long id, string payload, int deliveryCount)>(
            new CommandDefinition(FetchSql, new { Topic = topic, BatchSize = PollBatchSize },
                transaction, cancellationToken: stoppingToken));

        await transaction.CommitAsync(stoppingToken);

        return messages.AsList();
    }

    internal async Task HandleMessagesAsync(
        string topic,
        List<(long id, string payload, int deliveryCount)> messages,
        CancellationToken stoppingToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(stoppingToken);
        foreach (var (id, payload, deliveryCount) in messages)
        {
            stoppingToken.ThrowIfCancellationRequested();
            // A preceding handler may have outlived the lease on the rest of this batch.
            if (!await RenewLeaseAsync(id, deliveryCount, stoppingToken))
                continue;

            using var renewal = CancellationTokenSource.CreateLinkedTokenSource(stoppingToken);
            var renewing = RenewUntilCompletedAsync(id, deliveryCount, renewal.Token);
            string error;
            var retainedLease = false;
            try
            {
                error = await HandleAsync(payload);
            }
            finally
            {
                await renewal.CancelAsync();
                retainedLease = await renewing;
            }
            if (retainedLease && !stoppingToken.IsCancellationRequested)
                await MarkAsProcessed(connection, id, deliveryCount, error);
        }

        return;

        async Task<string> HandleAsync(string payload)
        {
            using var scope = scopeFactory.CreateScope();
            var handler = scope.ServiceProvider.GetKeyedService<IMessageHandler>(topic);

            if (handler is null)
            {
                Log.NoHandlerForTopic(logger, topic);
                return $"No handler for topic: {topic}";
            }

            try
            {
                await handler.HandleAsync(payload);
                Log.MessageHandled(logger, payload);

                return string.Empty;
            }
            catch (Exception ex)
            {
                Log.ErrorConsumeMessage(logger, payload, ex);
                return ex.Message;
            }
        }

        async Task MarkAsProcessed(NpgsqlConnection conn, long id, int deliveryCount, string error)
        {
            var status = string.IsNullOrWhiteSpace(error)
                ? QueueMessageStatus.Completed
                : QueueMessageStatus.Failed;

            const string ownedLease = "where id = @Id and deliver_count = @DeliveryCount " +
                                      "and status = 'Processing' and not_visible_until > now()";
            var sql = status == QueueMessageStatus.Completed
                ? "delete from queue_messages " + ownedLease
                : "update queue_messages set status = @Status, last_handled_at = now(), error = @Error " + ownedLease;
            var updated = await conn.ExecuteAsync(new CommandDefinition(sql,
                new { Status = status, Error = error, Id = id, DeliveryCount = deliveryCount },
                cancellationToken: stoppingToken));

            if (updated == 1)
                Log.MessageProcessed(logger, id, status, error);
            else
                Log.LeaseLost(logger, id);
        }
    }

    private async Task<bool> RenewLeaseAsync(long id, int deliveryCount, CancellationToken token)
    {
        await using var connection = await dataSource.OpenConnectionAsync(token);
        var updated = await connection.ExecuteAsync(new CommandDefinition("""
            update queue_messages set not_visible_until = now() + interval '1 minute'
            where id = @Id and deliver_count = @DeliveryCount
                and status = 'Processing' and not_visible_until > now()
            """, new { Id = id, DeliveryCount = deliveryCount }, cancellationToken: token));
        if (updated == 0)
            Log.LeaseLost(logger, id);
        return updated == 1;
    }

    private async Task<bool> RenewUntilCompletedAsync(long id, int deliveryCount, CancellationToken token)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromSeconds(20), _timeProvider);
        try
        {
            while (await timer.WaitForNextTickAsync(token))
            {
                if (!await RenewLeaseAsync(id, deliveryCount, token))
                    return false;
            }
        }
        catch (OperationCanceledException) when (token.IsCancellationRequested)
        {
            // Completion stops renewal; acknowledgement still checks the lease in PostgreSQL.
        }
        catch (Exception exception)
        {
            Log.LeaseRenewalFailed(logger, id, exception);
            return false;
        }

        return true;
    }
}
