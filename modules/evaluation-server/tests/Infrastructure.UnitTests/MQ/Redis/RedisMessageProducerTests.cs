using Infrastructure.Caches.Redis;
using Infrastructure.MQ.Redis;
using Microsoft.Extensions.Logging.Testing;
using Moq;
using StackExchange.Redis;

namespace Infrastructure.UnitTests.MQ.Redis;

public class RedisMessageProducerTests
{
    [Fact]
    public async Task PublishAsync_WriteFails_PropagatesFailure()
    {
        var database = new Mock<IDatabase>();
        database.Setup(x => x.ListRightPushAsync(It.IsAny<RedisKey>(), It.IsAny<RedisValue>(), When.Always, CommandFlags.None))
            .ThrowsAsync(new IOException("queue unavailable"));

        await Assert.ThrowsAsync<IOException>(() => CreateSut(database).PublishAsync("topic", new TestMessage(1)));
    }

    [Fact]
    public async Task PublishBatchAsync_WriteFails_PropagatesFailure()
    {
        var database = new Mock<IDatabase>();
        database.Setup(x => x.ListRightPushAsync(It.IsAny<RedisKey>(), It.IsAny<RedisValue[]>(), When.Always, CommandFlags.None))
            .ThrowsAsync(new IOException("queue unavailable"));

        await Assert.ThrowsAsync<IOException>(() => CreateSut(database).PublishBatchAsync("topic", new[] { new TestMessage(1) }));
    }

    [Theory]
    [InlineData(1)]
    [InlineData(100)]
    [InlineData(201)]
    public async Task PublishBatchAsync_MultipleRecords_UsesOneAtomicAppend(int count)
    {
        var database = new Mock<IDatabase>();
        var batches = new List<int>();
        database.Setup(x => x.ListRightPushAsync(It.IsAny<RedisKey>(), It.IsAny<RedisValue[]>(), When.Always, CommandFlags.None))
            .Callback<RedisKey, RedisValue[], When, CommandFlags>((_, values, _, _) => batches.Add(values.Length))
            .ReturnsAsync(count);

        await CreateSut(database).PublishBatchAsync("topic", Enumerable.Range(0, count).Select(x => new TestMessage(x)).ToArray());

        Assert.Equal(count, Assert.Single(batches));
    }

    private static RedisMessageProducer CreateSut(Mock<IDatabase> database)
    {
        var client = new Mock<IRedisClient>();
        client.Setup(x => x.GetDatabase()).Returns(database.Object);
        return new RedisMessageProducer(client.Object, new FakeLogger<RedisMessageProducer>());
    }

    private sealed record TestMessage(int Id);
}
