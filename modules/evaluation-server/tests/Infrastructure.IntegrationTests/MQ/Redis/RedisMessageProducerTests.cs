using System.Text.Json;
using Infrastructure.Caches.Redis;
using Infrastructure.IntegrationTests.Fixtures;
using Infrastructure.MQ.Redis;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Testing;
using StackExchange.Redis;

namespace Infrastructure.IntegrationTests.MQ.Redis;

[Collection(RedisCollection.Name)]
public class RedisMessageProducerTests(RedisFixture fixture) : IntegrationTestBase
{
    [DockerFact]
    public async Task PublishBatchAsync_QueueInvalidThenRestored_PropagatesFailureAndRetriesWholeBatch()
    {
        var configuration = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["Redis:ConnectionString"] = fixture.ConnectionString
        }).Build();
        var client = new RedisClient(configuration);
        var topic = $"producer-{Guid.NewGuid():N}";
        var producer = new RedisMessageProducer(client, new FakeLogger<RedisMessageProducer>());
        var messages = Enumerable.Range(0, 201).Select(x => new TestMessage(x)).ToArray();
        try
        {
            await client.GetDatabase().StringSetAsync(topic, "wrong queue type");

            await Assert.ThrowsAsync<RedisServerException>(() => producer.PublishBatchAsync(topic, messages));
            await client.GetDatabase().KeyDeleteAsync(topic);
            await producer.PublishBatchAsync(topic, messages);

            var queued = await client.GetDatabase().ListRangeAsync(topic);
            Assert.Equal(Enumerable.Range(0, 201), queued.Select(value =>
                JsonSerializer.Deserialize<JsonElement>((string)value!).GetProperty("id").GetInt32()));
        }
        finally
        {
            await client.GetDatabase().KeyDeleteAsync(topic);
            client.Connection.Dispose();
        }
    }

    private sealed record TestMessage(int Id);
}
