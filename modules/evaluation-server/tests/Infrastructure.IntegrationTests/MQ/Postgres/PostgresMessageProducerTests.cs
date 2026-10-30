using Dapper;
using Infrastructure.IntegrationTests.Fixtures;
using Infrastructure.MQ.Postgres;
using Microsoft.Extensions.Logging.Testing;
using Npgsql;

namespace Infrastructure.IntegrationTests.MQ.Postgres;

[Collection(PostgresCollection.Name)]
public class PostgresMessageProducerTests(PostgresFixture fixture) : IntegrationTestBase, IAsyncLifetime
{
    private readonly string _schema = $"producer_{Guid.NewGuid():N}";
    private NpgsqlDataSource _source = null!;

    public async Task InitializeAsync()
    {
        if (!DockerAvailability.IsAvailable) return;
        await using var connection = new NpgsqlConnection(fixture.ConnectionString);
        await connection.OpenAsync();
        await connection.ExecuteAsync($"create schema {_schema}");
        var options = new NpgsqlConnectionStringBuilder(fixture.ConnectionString) { SearchPath = _schema };
        _source = NpgsqlDataSource.Create(options.ConnectionString);
    }

    public async Task DisposeAsync()
    {
        if (!DockerAvailability.IsAvailable) return;
        await using var connection = new NpgsqlConnection(fixture.ConnectionString);
        await connection.OpenAsync();
        await connection.ExecuteAsync($"drop schema {_schema} cascade");
        await _source.DisposeAsync();
    }

    [DockerTheory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task PublishAsync_QueueUnavailableThenRestored_PropagatesFailureAndCanRetry(bool batch)
    {
        var producer = new PostgresMessageProducer(_source, new FakeLogger<PostgresMessageProducer>());
        var messages = Enumerable.Range(0, batch ? 201 : 1).Select(x => new TestMessage(x)).ToArray();
        Task Publish() => batch ? producer.PublishBatchAsync("topic", messages) : producer.PublishAsync("topic", messages[0]);

        var failure = await Assert.ThrowsAsync<PostgresException>(Publish);
        Assert.Equal(PostgresErrorCodes.UndefinedTable, failure.SqlState);
        await using var connection = await _source.OpenConnectionAsync();
        await connection.ExecuteAsync("create table queue_messages (id bigint generated always as identity primary key, topic varchar, payload text)");
        await Publish();

        Assert.Equal(messages.Length, await connection.ExecuteScalarAsync<int>("select count(*) from queue_messages"));
    }

    private sealed record TestMessage(int Id);
}
