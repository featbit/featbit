using System.Reflection;
using Dapper;
using FeatBit.Observability.TestKit;
using Domain.Observability;
using Infrastructure.IntegrationTests.Fixtures;
using Infrastructure.MQ.Postgres;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Testing;
using Npgsql;

namespace Infrastructure.IntegrationTests.MQ.Postgres;

/// <summary>
/// Runtime proof that the widened poll query in <see cref="PostgresMessageConsumer"/> — the one whose
/// <c>returning</c> clause grew to
/// <c>qm.id, qm.payload, qm.deliver_count, qm.trace_parent, qm.trace_state</c> — binds into its
/// five-element <c>ValueTuple</c> correctly against a real Postgres.
///
/// Dapper maps <c>ValueTuple</c> results positionally, so the risks these tests close are:
/// (1) trace columns silently landing in the wrong string slots, (2) <c>deliver_count</c> staying
/// at the <c>int</c> default instead of the real column, and (3) the widening shifting
/// <c>id</c>/<c>payload</c> off their positions. These failures leave a green build and plausible
/// handling behavior while severing traces or hiding redeliveries.
///
/// The production <c>PollAsync</c> method is exercised directly (via reflection) rather than by
/// re-issuing the SQL from the test, so the exact production query, tuple type, Dapper call, and
/// redelivered-counting logic are what run.
/// </summary>
[Collection(FeatBitPostgresCollection.Name)]
public class PostgresMessageConsumerTests : IntegrationTestBase, IAsyncLifetime
{
    private readonly FeatBitPostgresFixture _fixture;
    private NpgsqlDataSource _dataSource = null!;

    public PostgresMessageConsumerTests(FeatBitPostgresFixture fixture)
    {
        _fixture = fixture;
    }

    public async Task InitializeAsync()
    {
        if (!DockerAvailability.IsAvailable)
        {
            return;
        }

        _dataSource = NpgsqlDataSource.Create(_fixture.ConnectionString);

        // Collection fixtures live for the whole assembly run, so each test clears the table itself
        // (CONTRIBUTING-tests.md §12 rule 4). Unique topics per test keep runs independent regardless.
        await using var connection = await _dataSource.OpenConnectionAsync();
        await connection.ExecuteAsync("truncate table queue_messages restart identity");
    }

    public async Task DisposeAsync()
    {
        if (_dataSource is not null)
        {
            await _dataSource.DisposeAsync();
        }
    }

    [DockerFact]
    public async Task PollAsync_WidenedQuery_MapsAllFiveColumnsPositionally()
    {
        var topic = UniqueTopic("mapping");
        const string payload = "payload-mapping-proof";
        const string traceParent = "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01";
        const string traceState = "vendor=abc";

        // The poll increments deliver_count as part of claiming the row, so seeding 6 yields a mapped
        // third element of exactly 7. The other values are deliberately distinct strings, so a
        // positional shift cannot accidentally satisfy all assertions.
        var id = await InsertMessageAsync(topic, payload, 6, traceParent, traceState);

        var polled = await PollAsync(topic);

        var message = Assert.Single(polled);
        Assert.Equal(id, message.Id);
        Assert.Equal(payload, message.Payload);
        Assert.Equal(7, message.DeliverCount);
        Assert.Equal(traceParent, message.TraceParent);
        Assert.Equal(traceState, message.TraceState);
    }

    [DockerFact]
    public async Task PollAsync_NullTraceColumns_MapsTraceContextAsNull()
    {
        var topic = UniqueTopic("null-trace");
        const string payload = "payload-null-trace";

        var id = await InsertMessageAsync(topic, payload, deliverCount: 0, traceParent: null, traceState: null);

        var polled = await PollAsync(topic);

        var message = Assert.Single(polled);
        Assert.Equal(id, message.Id);
        Assert.Equal(payload, message.Payload);
        Assert.Equal(1, message.DeliverCount);
        Assert.Null(message.TraceParent);
        Assert.Null(message.TraceState);
    }

    [DockerFact]
    public async Task PollAsync_MessageRedeliveredAfterCrash_IncrementsRedeliveredCounter()
    {
        var topic = UniqueTopic("redelivered");

        // deliver_count = 1 simulates a message an earlier attempt already claimed; this poll takes it
        // to 2, which is > 1 and therefore a genuine redelivery.
        await InsertMessageAsync(topic, "payload-redelivered", deliverCount: 1);

        using var collector = new MetricCollector(MessagingMetrics.Current.Meter, "messaging.redelivered");

        await PollAsync(topic);

        var measurement = Assert.Single(
            collector.For("messaging.redelivered"),
            m => m.Tag(ObservabilityTags.Destination) == topic);
        Assert.Equal(1, measurement.Value);
        Assert.Equal(MessagingSystems.Postgres, measurement.Tag(ObservabilityTags.Provider));
    }

    [DockerFact]
    public async Task PollAsync_FirstDelivery_DoesNotIncrementRedeliveredCounter()
    {
        var topic = UniqueTopic("first-delivery");

        // deliver_count = 0 is a never-before-delivered message; this poll takes it to 1, which is not
        // > 1, so nothing must be recorded on messaging.redelivered for it.
        await InsertMessageAsync(topic, "payload-first-delivery", deliverCount: 0);

        using var collector = new MetricCollector(MessagingMetrics.Current.Meter, "messaging.redelivered");

        await PollAsync(topic);

        Assert.DoesNotContain(
            collector.For("messaging.redelivered"),
            m => m.Tag(ObservabilityTags.Destination) == topic);
    }

    private async Task<long> InsertMessageAsync(
        string topic,
        string payload,
        int deliverCount,
        string? traceParent = null,
        string? traceState = null)
    {
        await using var connection = await _dataSource.OpenConnectionAsync();
        return await connection.ExecuteScalarAsync<long>(
            """
            insert into queue_messages (topic, status, deliver_count, payload, trace_parent, trace_state)
            values (@Topic, 'Pending', @DeliverCount, @Payload, @TraceParent, @TraceState)
            returning id
            """,
            new
            {
                Topic = topic,
                DeliverCount = deliverCount,
                Payload = payload,
                TraceParent = traceParent,
                TraceState = traceState
            });
    }

    private async Task<List<(
        long Id,
        string Payload,
        int DeliverCount,
        string? TraceParent,
        string? TraceState)>> PollAsync(string topic)
    {
        var scopeFactory = new ServiceCollection()
            .BuildServiceProvider()
            .GetRequiredService<IServiceScopeFactory>();

        var consumer = new PostgresMessageConsumer(
            scopeFactory,
            _dataSource,
            new FakeLogger<PostgresMessageConsumer>(),
            [topic]);

        var pollAsync = typeof(PostgresMessageConsumer)
            .GetMethod("PollAsync", BindingFlags.Instance | BindingFlags.NonPublic)!;

        var task = (Task<List<(long, string, int, string?, string?)>>)pollAsync.Invoke(
            consumer, [topic, CancellationToken.None])!;

        return await task;
    }

    private static string UniqueTopic(string label) => $"cp-consumer-{label}-{Guid.NewGuid():N}";
}
