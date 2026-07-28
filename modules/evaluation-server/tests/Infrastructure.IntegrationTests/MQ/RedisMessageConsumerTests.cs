using Domain.Messages;
using Infrastructure.Caches.Redis;
using Infrastructure.IntegrationTests.Fixtures;
using Infrastructure.MQ.Redis;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using StackExchange.Redis;

namespace Infrastructure.IntegrationTests.MQ;

[Collection(RedisCollection.Name)]
public class RedisMessageConsumerTests(RedisFixture fixture)
{
    [DockerTheory]
    [InlineData(Topics.FeatureFlagChange, "{\"id\":\"flag-1\"}", true)]
    [InlineData(Topics.SegmentChange, "{\"id\":\"segment-1\"}", true)]
    [InlineData(Topics.ControlPlaneCommand, "{\"action\":\"pushFullSync\"}", false)]
    public async Task ExecuteAsync_MessagePublished_DispatchesToHandler(
        string topic,
        string message,
        bool isPatternSubscription)
    {
        using var connection = await ConnectionMultiplexer.ConnectAsync(fixture.ConnectionString);
        var redisClient = new Mock<IRedisClient>();
        redisClient.Setup(x => x.GetSubscriber()).Returns(connection.GetSubscriber());

        var handledMessage = new TaskCompletionSource<string>(TaskCreationOptions.RunContinuationsAsynchronously);
        var handler = new Mock<IMessageConsumer>();
        handler.SetupGet(x => x.Topic).Returns(topic);
        handler
            .Setup(x => x.HandleAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .Returns((string messageToHandle, CancellationToken _) =>
            {
                handledMessage.TrySetResult(messageToHandle);
                return Task.CompletedTask;
            });

        var sut = new RedisMessageConsumer(
            redisClient.Object,
            [handler.Object],
            NullLogger<RedisMessageConsumer>.Instance);

        await sut.StartAsync(CancellationToken.None);
        try
        {
            var server = connection.GetServer(connection.GetEndPoints().Single());
            var channel = RedisChannel.Literal(topic);
            await WaitForSubscriptionAsync(server, channel, isPatternSubscription);

            var subscriberCount = await connection.GetSubscriber().PublishAsync(channel, message);

            Assert.Equal(1, subscriberCount);
            var completedTask = await Task.WhenAny(handledMessage.Task, Task.Delay(TimeSpan.FromSeconds(2)));
            Assert.True(
                ReferenceEquals(handledMessage.Task, completedTask),
                $"The Redis subscription for '{topic}' received the publication but did not dispatch it to the handler.");
            Assert.Equal(message, await handledMessage.Task);
        }
        finally
        {
            await sut.StopAsync(CancellationToken.None);
        }
    }

    private static async Task WaitForSubscriptionAsync(
        IServer server,
        RedisChannel channel,
        bool isPatternSubscription)
    {
        using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(5));

        while (!timeout.Token.IsCancellationRequested)
        {
            var subscriberCount = isPatternSubscription
                ? await server.SubscriptionPatternCountAsync()
                : await server.SubscriptionSubscriberCountAsync(channel);

            if (subscriberCount > 0)
            {
                return;
            }

            await Task.Delay(25, timeout.Token);
        }
    }
}