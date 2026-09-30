using Domain.Observability;
using Infrastructure.Caches.Redis;
using Infrastructure.MQ.Backlog;
using Infrastructure.MQ.Redis;
using Moq;

namespace Infrastructure.UnitTests.MQ.Backlog;

public class RedisBacklogProbeTests
{
    [Fact]
    public void Topics_AreExactlyTheListConsumedTopics()
    {
        // Arrange & Act
        var probe = new RedisBacklogProbe(Mock.Of<IRedisClient>());

        // Assert
        // Pub/sub channels are deliberately absent: an undelivered pub/sub message is discarded
        // rather than queued, so its depth is permanently zero — which reads as "healthy and
        // drained" and is worse than not reporting at all.
        Assert.Equal(RedisConsumerTopics.All, probe.Topics);
    }

    [Fact]
    public void Provider_IsTheRedisMessagingSystem()
    {
        // Arrange & Act
        var probe = new RedisBacklogProbe(Mock.Of<IRedisClient>());

        // Assert
        Assert.Equal(MessagingSystems.Redis, probe.Provider);
    }
}
