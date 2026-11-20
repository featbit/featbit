using Dapper;
using Domain.Messages;
using Infrastructure.IntegrationTests.Fixtures;
using Infrastructure.MQ.Postgres;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Testing;
using Microsoft.Extensions.Time.Testing;
using Npgsql;

namespace Infrastructure.IntegrationTests.MQ.Postgres;

[Collection(PostgresCollection.Name)]
public class PostgresMessageConsumerTests(PostgresFixture fixture) : IntegrationTestBase
{
    private const string Topic = "lease-test";

    [DockerFact]
    public async Task HandleMessagesAsync_LongHandler_RenewsLeaseUntilCompletion()
    {
        await using var dataSource = await CreateDataSourceAsync();
        var entered = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var release = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var renewed = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        await using var services = new ServiceCollection()
            .AddKeyedScoped<IMessageHandler>(Topic, (_, _) => new CallbackHandler(async () =>
            {
                entered.SetResult();
                await release.Task;
            }))
            .BuildServiceProvider();
        var clock = new FakeTimeProvider();
        using var consumer = CreateConsumer(dataSource, services, clock);
        await using var connection = await dataSource.OpenConnectionAsync();
        await connection.ExecuteAsync("""
            create function notify_renewal() returns trigger language plpgsql as $$
            begin
                if old.not_visible_until < now() + interval '10 seconds'
                    and new.not_visible_until > now() + interval '50 seconds' then
                    perform pg_notify(current_schema(), 'renewed');
                end if;
                return new;
            end $$;
            create trigger queue_renewal after update on queue_messages
                for each row execute function notify_renewal();
            insert into queue_messages (topic, payload) values (@Topic, 'event');
            """, new { Topic });
        await using var listener = await dataSource.OpenConnectionAsync();
        var schema = await connection.ExecuteScalarAsync<string>("select current_schema()");
        await listener.ExecuteAsync($"listen {schema}");
        listener.Notification += (_, _) => renewed.TrySetResult();
        using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(10));
        var notification = listener.WaitAsync(timeout.Token);
        var messages = await consumer.PollAsync(Topic, CancellationToken.None);
        var handling = consumer.HandleMessagesAsync(Topic, messages, CancellationToken.None);
        try
        {
            await entered.Task.WaitAsync(TimeSpan.FromSeconds(10));
            await connection.ExecuteAsync("update queue_messages set not_visible_until = now() + interval '1 second'");
            clock.Advance(TimeSpan.FromSeconds(20));
            await notification;
            await renewed.Task.WaitAsync(TimeSpan.FromSeconds(10));

            Assert.True(await connection.ExecuteScalarAsync<bool>(
                "select not_visible_until > now() + interval '50 seconds' from queue_messages"));
            Assert.Empty(await consumer.PollAsync(Topic, CancellationToken.None));
        }
        finally
        {
            release.TrySetResult();
            await handling.WaitAsync(TimeSpan.FromSeconds(10));
        }

        Assert.Equal(0, await connection.ExecuteScalarAsync<int>("select count(*) from queue_messages"));
    }

    [DockerTheory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task HandleMessagesAsync_OwnedLease_CompletesAndDisposesHandler(bool fail)
    {
        await using var dataSource = await CreateDataSourceAsync();
        var disposed = false;
        await using var services = new ServiceCollection()
            .AddKeyedScoped<IMessageHandler>(Topic, (_, _) => new CallbackHandler(
                () => fail ? Task.FromException(new IOException("handler failed")) : Task.CompletedTask,
                () => disposed = true))
            .BuildServiceProvider();
        using var consumer = CreateConsumer(dataSource, services);
        await using var connection = await dataSource.OpenConnectionAsync();
        await connection.ExecuteAsync("insert into queue_messages (topic, payload) values (@Topic, 'event')", new { Topic });
        var messages = await consumer.PollAsync(Topic, CancellationToken.None);

        await consumer.HandleMessagesAsync(Topic, messages, CancellationToken.None);

        Assert.True(disposed);
        if (fail)
        {
            var row = await connection.QuerySingleAsync<(string status, string error)>(
                "select status, error from queue_messages");
            Assert.Equal("Failed", row.status);
            Assert.Equal("handler failed", row.error);
        }
        else
        {
            Assert.Equal(0, await connection.ExecuteScalarAsync<int>("select count(*) from queue_messages"));
        }
    }

    [DockerFact]
    public async Task PollAsync_ExpiredProcessingLease_ReclaimsOnlyAvailableMessages()
    {
        await using var dataSource = await CreateDataSourceAsync();
        await using var services = new ServiceCollection().BuildServiceProvider();
        using var consumer = CreateConsumer(dataSource, services);
        await using var connection = await dataSource.OpenConnectionAsync();
        await connection.ExecuteAsync("""
            insert into queue_messages (topic, status, not_visible_until, deliver_count, payload) values
                (@Topic, 'Pending', null, 0, 'new'),
                (@Topic, 'Processing', now() - interval '1 second', 3, 'crashed'),
                (@Topic, 'Processing', now() + interval '1 minute', 1, 'active'),
                (@Topic, 'Pending', now() + interval '1 minute', 0, 'delayed'),
                (@Topic, 'Failed', now() - interval '1 second', 1, 'failed');
            """, new { Topic });

        var messages = await consumer.PollAsync(Topic, CancellationToken.None);

        Assert.Equal(new[] { "crashed", "new" }, messages.Select(x => x.payload).Order().ToArray());
        Assert.Equal(4, messages.Single(x => x.payload == "crashed").deliveryCount);
        Assert.Equal(1, messages.Single(x => x.payload == "new").deliveryCount);
    }

    [DockerFact]
    public async Task PollAsync_ConcurrentConsumers_ClaimDisjointBatches()
    {
        await using var dataSource = await CreateDataSourceAsync();
        await using var services = new ServiceCollection().BuildServiceProvider();
        using var first = CreateConsumer(dataSource, services);
        using var second = CreateConsumer(dataSource, services);
        await using var connection = await dataSource.OpenConnectionAsync();
        await connection.ExecuteAsync("""
            insert into queue_messages (topic, payload)
            select @Topic, value::text from generate_series(1, 200) value;
            """, new { Topic });

        var batches = await Task.WhenAll(first.PollAsync(Topic, CancellationToken.None),
            second.PollAsync(Topic, CancellationToken.None));

        Assert.All(batches, batch => Assert.Equal(100, batch.Count));
        Assert.Equal(200, batches.SelectMany(x => x).Select(x => x.id).Distinct().Count());
    }

    [DockerTheory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task HandleMessagesAsync_ReplacedLease_LateCompletionCannotAlterNewDelivery(bool fail)
    {
        await using var dataSource = await CreateDataSourceAsync();
        var entered = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var release = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        await using var services = new ServiceCollection()
            .AddKeyedScoped<IMessageHandler>(Topic, (_, _) => new CallbackHandler(async () =>
            {
                entered.SetResult();
                await release.Task;
                if (fail) throw new IOException("handler failed");
            }))
            .BuildServiceProvider();
        using var consumer = CreateConsumer(dataSource, services);
        await using var connection = await dataSource.OpenConnectionAsync();
        await connection.ExecuteAsync("insert into queue_messages (topic, payload) values (@Topic, 'event')", new { Topic });
        var messages = await consumer.PollAsync(Topic, CancellationToken.None);
        var handling = consumer.HandleMessagesAsync(Topic, messages, CancellationToken.None);
        try
        {
            await entered.Task.WaitAsync(TimeSpan.FromSeconds(10));
            await connection.ExecuteAsync("""
                update queue_messages set not_visible_until = now() - interval '1 second';
                """);
            var recovered = Assert.Single(await consumer.PollAsync(Topic, CancellationToken.None));
            Assert.Equal(2, recovered.deliveryCount);
        }
        finally
        {
            release.TrySetResult();
            await handling.WaitAsync(TimeSpan.FromSeconds(10));
        }

        var row = await connection.QuerySingleAsync<(string status, int count)>(
            "select status, deliver_count from queue_messages");
        Assert.Equal("Processing", row.status);
        Assert.Equal(2, row.count);
    }

    [DockerFact]
    public async Task HandleMessagesAsync_ShutdownDuringHandler_LeavesMessageForRecovery()
    {
        await using var dataSource = await CreateDataSourceAsync();
        var entered = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var release = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        await using var services = new ServiceCollection()
            .AddKeyedScoped<IMessageHandler>(Topic, (_, _) => new CallbackHandler(async () =>
            {
                entered.SetResult();
                await release.Task;
            }))
            .BuildServiceProvider();
        using var consumer = CreateConsumer(dataSource, services);
        await using var connection = await dataSource.OpenConnectionAsync();
        await connection.ExecuteAsync("insert into queue_messages (topic, payload) values (@Topic, 'event')", new { Topic });
        var messages = await consumer.PollAsync(Topic, CancellationToken.None);
        using var stopping = new CancellationTokenSource();
        var handling = consumer.HandleMessagesAsync(Topic, messages, stopping.Token);
        try
        {
            await entered.Task.WaitAsync(TimeSpan.FromSeconds(10));
            await stopping.CancelAsync();
        }
        finally
        {
            release.TrySetResult();
            await handling.WaitAsync(TimeSpan.FromSeconds(10));
        }

        Assert.Equal("Processing", await connection.ExecuteScalarAsync<string>("select status from queue_messages"));
    }

    [DockerTheory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task HandleMessagesAsync_LostOrExpiredBatchLease_DoesNotStartHandler(bool replaced)
    {
        await using var dataSource = await CreateDataSourceAsync();
        var calls = 0;
        await using var services = new ServiceCollection()
            .AddKeyedScoped<IMessageHandler>(Topic, (_, _) => new CallbackHandler(() =>
            {
                Interlocked.Increment(ref calls);
                return Task.CompletedTask;
            }))
            .BuildServiceProvider();
        using var consumer = CreateConsumer(dataSource, services);
        await using var connection = await dataSource.OpenConnectionAsync();
        await connection.ExecuteAsync("insert into queue_messages (topic, payload) values (@Topic, 'event')", new { Topic });
        var messages = await consumer.PollAsync(Topic, CancellationToken.None);
        await connection.ExecuteAsync(replaced
            ? "update queue_messages set deliver_count = deliver_count + 1"
            : "update queue_messages set not_visible_until = now() - interval '1 second'");

        await consumer.HandleMessagesAsync(Topic, messages, CancellationToken.None);

        Assert.Equal(0, calls);
        Assert.Equal(1, await connection.ExecuteScalarAsync<int>("select count(*) from queue_messages"));
    }

    private static PostgresMessageConsumer CreateConsumer(NpgsqlDataSource dataSource, ServiceProvider services,
        TimeProvider? timeProvider = null) =>
        new(services.GetRequiredService<IServiceScopeFactory>(), dataSource,
            new FakeLogger<PostgresMessageConsumer>(), [Topic], timeProvider);

    private async Task<NpgsqlDataSource> CreateDataSourceAsync()
    {
        var schema = "queue_lease_" + Guid.NewGuid().ToString("N");
        await using var admin = new NpgsqlConnection(fixture.ConnectionString);
        await admin.OpenAsync();
        await admin.ExecuteAsync($"create schema {schema}");
        var builder = new NpgsqlConnectionStringBuilder(fixture.ConnectionString) { SearchPath = schema };
        var dataSource = NpgsqlDataSource.Create(builder.ConnectionString);
        await using var connection = await dataSource.OpenConnectionAsync();
        await connection.ExecuteAsync("""
            create table queue_messages (
                id bigint generated always as identity primary key,
                topic varchar(128) not null,
                status varchar(64) not null default 'Pending',
                enqueued_at timestamptz default now(),
                not_visible_until timestamptz,
                last_deliver_at timestamptz,
                last_handled_at timestamptz,
                deliver_count integer not null default 0,
                payload text,
                error text
            );
            """);
        return dataSource;
    }

    private sealed class CallbackHandler(Func<Task> callback, System.Action? dispose = null) : IMessageHandler, IDisposable
    {
        public string Topic => PostgresMessageConsumerTests.Topic;
        public Task HandleAsync(string message) => callback();
        public void Dispose() => dispose?.Invoke();
    }
}
