using System.Collections.Concurrent;
using Dapper;
using Domain.Messages;
using Infrastructure.IntegrationTests.Fixtures;
using Infrastructure.MQ.Postgres;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Testing;
using Npgsql;

namespace Infrastructure.IntegrationTests.MQ;

[Collection(FeatBitPostgresCollection.Name)]
public class PostgresMessageConsumerTests(FeatBitPostgresFixture fixture) : IntegrationTestBase
{
    [DockerFact]
    public async Task RetainedMessageWithoutNotification_IsRecovered()
    {
        var handler = new Handler();
        using var consumer = NewConsumer(handler, out var listening);
        await consumer.StartAsync(CancellationToken.None);
        try
        {
            await listening.Task.WaitAsync(TimeSpan.FromSeconds(10));
            await InsertAsync("missing-notify");
            Assert.Equal("missing-notify", await handler.NextAsync());
        }
        finally { await consumer.StopAsync(CancellationToken.None); }
    }

    [DockerFact]
    public async Task BlockedHandler_BacklogExceedingNotificationCapacity_IsFullyReplayed()
    {
        var release = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var entered = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var delivered = new ConcurrentDictionary<string, byte>();
        var completed = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var handler = new Handler(async payload =>
        {
            if (payload == "first")
            {
                entered.TrySetResult();
                await release.Task.WaitAsync(TimeSpan.FromSeconds(15));
            }
            delivered.TryAdd(payload, 0);
            if (delivered.Count == 1202) completed.TrySetResult();
        });
        using var consumer = NewConsumer(handler, out var listening);
        await consumer.StartAsync(CancellationToken.None);
        try
        {
            await listening.Task.WaitAsync(TimeSpan.FromSeconds(10));
            await InsertAsync("first", notify: true);
            await entered.Task.WaitAsync(TimeSpan.FromSeconds(10));
            await using var connection = new NpgsqlConnection(fixture.ConnectionString);
            await connection.ExecuteAsync("""
                with added as (
                    insert into queue_messages(topic, status, payload)
                    select @Topic, 'Notified', 'backlog-' || n from generate_series(1,1201) n
                    returning id
                ) select pg_notify(@Channel, id::text) from added;
                """, new { Topic = Topics.FeatureFlagChange, Channel = Topics.ToChannel(Topics.FeatureFlagChange) });
            release.TrySetResult();
            await completed.Task.WaitAsync(TimeSpan.FromSeconds(15));
            Assert.Equal(1202, delivered.Count);
        }
        finally
        {
            release.TrySetResult();
            await consumer.StopAsync(CancellationToken.None);
        }
    }

    [DockerFact]
    public async Task FailedEarlierMessage_IsRetriedBeforeLaterMessage()
    {
        var attempts = new ConcurrentQueue<string>();
        var firstAttempt = 0;
        var completed = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var handler = new Handler(payload =>
        {
            attempts.Enqueue(payload);
            if (payload == "first" && Interlocked.Increment(ref firstAttempt) == 1)
                throw new InvalidOperationException("transient handler failure");
            if (payload == "second") completed.TrySetResult();
            return Task.CompletedTask;
        });
        using var consumer = NewConsumer(handler, out var listening);
        await consumer.StartAsync(CancellationToken.None);
        try
        {
            await listening.Task.WaitAsync(TimeSpan.FromSeconds(10));
            await InsertAsync("first", notify: true);
            await InsertAsync("second", notify: true);
            await completed.Task.WaitAsync(TimeSpan.FromSeconds(15));
            Assert.Equal(new[] { "first", "first", "second" }, attempts.ToArray());
        }
        finally { await consumer.StopAsync(CancellationToken.None); }
    }

    [DockerFact]
    public async Task OlderUncommittedId_IsRecoveredAfterNewerIdWasHandled()
    {
        await using var delayed = new NpgsqlConnection(fixture.ConnectionString);
        await delayed.OpenAsync();
        await using var transaction = await delayed.BeginTransactionAsync();
        await delayed.ExecuteAsync("""
            insert into queue_messages(topic,status,payload,enqueued_at)
            values (@Topic,'Notified','late-commit',now() - interval '1 hour');
            """, new { Topic = Topics.FeatureFlagChange }, transaction);
        var handler = new Handler();
        using var consumer = NewConsumer(handler, out var listening);
        await consumer.StartAsync(CancellationToken.None);
        try
        {
            await listening.Task.WaitAsync(TimeSpan.FromSeconds(10));
            await InsertAsync("newer-id", notify: true);
            Assert.Equal("newer-id", await handler.NextAsync());
            // Neither an id watermark nor an enqueued_at lookback may hide this transaction.
            await transaction.CommitAsync();
            Assert.Equal("late-commit", await handler.NextAsync());
        }
        finally { await consumer.StopAsync(CancellationToken.None); }
    }

    [DockerFact]
    public async Task TwoConsumers_EachReceiveThePublication()
    {
        var first = new Handler();
        var second = new Handler();
        using var one = NewConsumer(first, out var readyOne);
        using var two = NewConsumer(second, out var readyTwo);
        await one.StartAsync(CancellationToken.None);
        await two.StartAsync(CancellationToken.None);
        try
        {
            await Task.WhenAll(readyOne.Task, readyTwo.Task).WaitAsync(TimeSpan.FromSeconds(10));
            await InsertAsync("both", notify: true);
            Assert.Equal("both", await first.NextAsync());
            Assert.Equal("both", await second.NextAsync());
        }
        finally
        {
            await one.StopAsync(CancellationToken.None);
            await two.StopAsync(CancellationToken.None);
        }
    }

    [DockerFact]
    public async Task Reconnect_RecoversRowsWithoutANotification()
    {
        var handler = new Handler();
        var reconnected = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var notified = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        using var consumer = NewConsumer(handler, out var listening, reconnected: reconnected, notified: notified);
        await consumer.StartAsync(CancellationToken.None);
        try
        {
            await listening.Task.WaitAsync(TimeSpan.FromSeconds(10));
            await using var admin = new NpgsqlConnection(fixture.ConnectionString);
            await admin.ExecuteAsync("""
                select pg_terminate_backend(pid) from pg_stat_activity
                where application_name = 'els_pg_msg_consumer_keep_alived' and wait_event = 'ClientRead';
                """);
            await InsertAsync("during-reconnect");
            await reconnected.Task.WaitAsync(TimeSpan.FromSeconds(15));
            await InsertAsync("after-reconnect", notify: true);
            await notified.Task.WaitAsync(TimeSpan.FromSeconds(10));
            Assert.Equal("during-reconnect", await handler.NextAsync());
            Assert.Equal("after-reconnect", await handler.NextAsync());
        }
        finally { await consumer.StopAsync(CancellationToken.None); }
    }

    [DockerFact]
    public async Task Startup_ExcludesAlreadyCommittedHistory()
    {
        await InsertAsync("historical");
        var handler = new Handler();
        using var consumer = NewConsumer(handler, out var listening);
        await consumer.StartAsync(CancellationToken.None);
        try
        {
            await listening.Task.WaitAsync(TimeSpan.FromSeconds(10));
            await InsertAsync("current", notify: true);
            Assert.Equal("current", await handler.NextAsync());
        }
        finally { await consumer.StopAsync(CancellationToken.None); }
    }

    [DockerTheory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task Startup_RetriesUnavailableConnectionOrBaselineQuery(bool connectionUnavailable)
    {
        var adminOptions = new NpgsqlConnectionStringBuilder(fixture.ConnectionString);
        if (connectionUnavailable) adminOptions.Database = "postgres";
        await using var admin = new NpgsqlConnection(adminOptions.ConnectionString);
        await admin.OpenAsync();
        var builder = new NpgsqlConnectionStringBuilder(fixture.ConnectionString) { Pooling = false };
        var schema = "baseline_" + Guid.NewGuid().ToString("N");
        if (connectionUnavailable) await admin.ExecuteAsync("alter database featbit allow_connections false");
        else builder.SearchPath = schema;
        var retry = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var handler = new Handler();
        using var consumer = NewConsumer(handler, out var listening, builder.ConnectionString, retry);
        using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(20));
        var starting = consumer.StartAsync(timeout.Token);
        try
        {
            await retry.Task.WaitAsync(TimeSpan.FromSeconds(10));
            Assert.False(starting.IsCompleted);
            if (connectionUnavailable) await admin.ExecuteAsync("alter database featbit allow_connections true");
            else await admin.ExecuteAsync($"create schema {schema}; create table {schema}.queue_messages (like public.queue_messages including all)");
            await starting;
            await listening.Task.WaitAsync(TimeSpan.FromSeconds(10));
        }
        finally
        {
            // Restore the disposable container even if an assertion fails.
            if (connectionUnavailable) await admin.ExecuteAsync("alter database featbit allow_connections true");
            timeout.Cancel();
            try { await starting; } catch (OperationCanceledException) { }
            await consumer.StopAsync(CancellationToken.None);
            if (!connectionUnavailable) await admin.ExecuteAsync($"drop schema if exists {schema} cascade");
        }
    }

    [DockerFact]
    public async Task Startup_RetryBackoff_IsCancelledWithoutStartingTheListener()
    {
        var builder = new NpgsqlConnectionStringBuilder(fixture.ConnectionString)
            { SearchPath = "absent_" + Guid.NewGuid().ToString("N") };
        var retry = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        using var consumer = NewConsumer(new Handler(), out var listening, builder.ConnectionString, retry);
        using var cancellation = new CancellationTokenSource();
        var starting = consumer.StartAsync(cancellation.Token);
        await retry.Task.WaitAsync(TimeSpan.FromSeconds(10));
        cancellation.Cancel();
        await Assert.ThrowsAnyAsync<OperationCanceledException>(() => starting);
        Assert.False(listening.Task.IsCompleted);
    }

    private PostgresMessageConsumer NewConsumer(Handler handler, out TaskCompletionSource listening,
        string? connectionString = null, TaskCompletionSource? retry = null,
        TaskCompletionSource? reconnected = null, TaskCompletionSource? notified = null)
    {
        listening = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var configuration = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string,string?>
        {
            ["Postgres:ConnectionString"] = connectionString ?? fixture.ConnectionString
        }).Build();
        return new PostgresMessageConsumer(configuration, [handler], new SignalLogger(listening, retry, reconnected, notified));
    }

    private async Task InsertAsync(string payload, bool notify = false)
    {
        await using var connection = new NpgsqlConnection(fixture.ConnectionString);
        var id = await connection.QuerySingleAsync<long>("""
            insert into queue_messages(topic,status,payload) values (@Topic,'Notified',@Payload) returning id;
            """, new { Topic = Topics.FeatureFlagChange, Payload = payload });
        if (notify) await connection.ExecuteAsync("select pg_notify(@Channel,@Payload)",
            new { Channel = Topics.ToChannel(Topics.FeatureFlagChange), Payload = id.ToString() });
    }

    private sealed class Handler(Func<string,Task>? handle = null) : IMessageConsumer
    {
        private readonly System.Threading.Channels.Channel<string> _received =
            System.Threading.Channels.Channel.CreateUnbounded<string>();
        public string Topic => Topics.FeatureFlagChange;
        public async Task HandleAsync(string message, CancellationToken cancellationToken)
        {
            if (handle != null) await handle(message);
            _received.Writer.TryWrite(message);
        }
        public async Task<string> NextAsync() =>
            await _received.Reader.ReadAsync().AsTask().WaitAsync(TimeSpan.FromSeconds(15));
    }

    private sealed class SignalLogger(TaskCompletionSource listening, TaskCompletionSource? retry,
        TaskCompletionSource? reconnected, TaskCompletionSource? notified) : ILogger<PostgresMessageConsumer>
    {
        private readonly FakeLogger<PostgresMessageConsumer> _inner = new();
        private int _listenCount;
        public IDisposable? BeginScope<TState>(TState state) where TState : notnull => _inner.BeginScope(state);
        public bool IsEnabled(LogLevel level) => true;
        public void Log<TState>(LogLevel level, EventId id, TState state, Exception? exception,
            Func<TState,Exception?,string> formatter)
        {
            _inner.Log(level,id,state,exception,formatter);
            if (id.Id == 2)
            {
                listening.TrySetResult();
                if (Interlocked.Increment(ref _listenCount) > 1) reconnected?.TrySetResult();
            }
            if (id.Id == 4) notified?.TrySetResult();
            if (id.Id == 12) retry?.TrySetResult();
        }
    }
}
