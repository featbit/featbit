using System.Diagnostics;
using System.Text.Json;
using Domain.Messages;
using Domain.Observability;
using Domain.Utils;
using Infrastructure.Caches.Redis;
using Infrastructure.MQ.Redis;
using Infrastructure.UnitTests;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using StackExchange.Redis;

namespace Infrastructure.UnitTests.MQ.Redis;

/// <summary>
/// Proves the Redis producer reaches each topic the way that topic is actually consumed.
/// </summary>
/// <remarks>
/// <para>
/// <c>RedisConsumerTopicsTests</c> pins the routing <i>table</i>; this pins the producer's use of
/// it, which is the half that was actually broken. The control plane published
/// <c>featbit-control-plane-web-hooks</c> to a pub/sub channel while the back-end drained a list of
/// the same name, so every webhook notification was silently discarded under
/// <c>MqProvider=Redis</c> — publishing to a channel with no live subscriber is a no-op in Redis,
/// so there was no exception, no log line, and no failed health check.
/// </para>
/// <para>
/// A table that is correct but unread would fail exactly the same way, which is why this asserts
/// against the commands issued rather than against <c>IsQueue</c>.
/// </para>
/// </remarks>
[Collection(ActivityCorrelationCollection.Name)]
public class RedisMessageProducerRoutingTests
{
    private const string TestSource = "FeatBit.Tests.RedisMessageProducer";

    private sealed record TestMessage(string Id, string EnvId);

    [Fact]
    public async Task PublishAsync_ForTheControlPlaneWebHooksTopic_PushesToAListRatherThanPublishing()
    {
        // The regression itself: this is the topic whose messages were never received.
        var database = CreateDatabase();
        var producer = CreateSut(database);

        await producer.PublishAsync(ControlPlaneTopics.ControlPlaneWebHooks, new { id = "webhook" });

        VerifyListPush(database, ControlPlaneTopics.ControlPlaneWebHooks, Times.Once());
        VerifyPublish(database, Times.Never());
    }

    /// <summary>
    /// The second, more severe occurrence: every topic the control plane drains was published to a
    /// pub/sub channel instead, so the control plane received nothing at all and flag changes never
    /// propagated under <c>MqProvider=Redis</c>.
    /// </summary>
    [Theory]
    [InlineData(ControlPlaneTopics.ControlPlaneFeatureFlagChange)]
    [InlineData(ControlPlaneTopics.ControlPlaneSegmentChange)]
    [InlineData(ControlPlaneTopics.ControlPlaneSecretChange)]
    [InlineData(ControlPlaneTopics.ControlPlaneLicenseChange)]
    [InlineData(ControlPlaneTopics.ConnectionMade)]
    [InlineData(ControlPlaneTopics.ConnectionClosed)]
    [InlineData(ControlPlaneTopics.PodHeartbeat)]
    public async Task PublishAsync_ForATopicTheControlPlaneConsumes_PushesToAListRatherThanPublishing(
        string topic)
    {
        var database = CreateDatabase();
        var producer = CreateSut(database);

        await producer.PublishAsync(topic, new { id = "message" });

        VerifyListPush(database, topic, Times.Once());
        VerifyPublish(database, Times.Never());
    }

    [Theory]
    [InlineData(Topics.EndUser)]
    [InlineData(Topics.Insights)]
    [InlineData(Topics.Usage)]
    [InlineData(ControlPlaneTopics.ControlPlaneWebHooks)]
    public async Task PublishAsync_ForAListConsumedTopic_PushesToAList(string topic)
    {
        var database = CreateDatabase();
        var producer = CreateSut(database);

        await producer.PublishAsync(topic, new { id = "message" });

        VerifyListPush(database, topic, Times.Once());
        VerifyPublish(database, Times.Never());
    }

    [Theory]
    [InlineData(Topics.FeatureFlagChange)]
    [InlineData(Topics.SegmentChange)]
    [InlineData(ControlPlaneTopics.ControlPlaneCommand)]
    public async Task PublishAsync_ForAPubSubConsumedTopic_Publishes(string topic)
    {
        // The opposite error is just as silent: RPUSHing a topic the evaluation server reaches by
        // subscription would leave the messages sitting in a list nothing drains, growing forever.
        var database = CreateDatabase();
        var producer = CreateSut(database);

        await producer.PublishAsync(topic, new { id = "message" });

        VerifyPublish(database, Times.Once());
        database.Verify(
            x => x.ListRightPushAsync(
                It.IsAny<RedisKey>(), It.IsAny<RedisValue>(), It.IsAny<When>(), It.IsAny<CommandFlags>()),
            Times.Never());
    }

    [Fact]
    public async Task PublishAsync_ForEveryTopicInTheConsumerList_MatchesTheRoutingTable()
    {
        // Locks the producer to the table so the two cannot drift apart — the drift is what caused
        // the original defect.
        foreach (var topic in RedisConsumerTopics.All)
        {
            var database = CreateDatabase();
            var producer = CreateSut(database);

            await producer.PublishAsync(topic, new { id = "message" });

            VerifyListPush(database, topic, Times.Once());
        }
    }

    [Fact]
    public async Task PublishAsync_ForAListConsumedTopicWithAmbientActivity_InjectsTraceContextIntoPayload()
    {
        var listPayloads = new List<string>();
        var database = CreateDatabase(listPayloads: listPayloads);
        var producer = CreateSut(database);

        using var listener = Listen();
        using var source = new ActivitySource(TestSource);
        using var activity = source.StartActivity("publish");
        Assert.NotNull(activity);

        await producer.PublishAsync(Topics.EndUser, new TestMessage("message", "env-1"));

        var payload = Assert.Single(listPayloads);
        AssertInjectedPayload(payload, Activity.Current!.Id!);
    }

    [Fact]
    public async Task PublishAsync_ForAPubSubConsumedTopicWithAmbientActivity_InjectsTraceContextIntoPayload()
    {
        var publishedPayloads = new List<string>();
        var database = CreateDatabase(publishedPayloads: publishedPayloads);
        var producer = CreateSut(database);

        using var listener = Listen();
        using var source = new ActivitySource(TestSource);
        using var activity = source.StartActivity("publish");
        Assert.NotNull(activity);

        await producer.PublishAsync(Topics.FeatureFlagChange, new TestMessage("message", "env-1"));

        var payload = Assert.Single(publishedPayloads);
        AssertInjectedPayload(payload, Activity.Current!.Id!);
    }

    [Fact]
    public async Task PublishAsync_WithNoAmbientActivity_PublishesPlainSerializedPayload()
    {
        var listPayloads = new List<string>();
        var database = CreateDatabase(listPayloads: listPayloads);
        var producer = CreateSut(database);
        var message = new TestMessage("message", "env-1");
        var expected = JsonSerializer.Serialize(message, ReusableJsonSerializerOptions.Web);

        await producer.PublishAsync(Topics.EndUser, message);

        Assert.Equal(expected, Assert.Single(listPayloads));
    }

    private static Mock<IDatabase> CreateDatabase()
        => CreateDatabase(null, null);

    private static Mock<IDatabase> CreateDatabase(
        IList<string>? listPayloads = null,
        IList<string>? publishedPayloads = null)
    {
        var database = new Mock<IDatabase>();

        database
            .Setup(x => x.ListRightPushAsync(
                It.IsAny<RedisKey>(), It.IsAny<RedisValue>(), It.IsAny<When>(), It.IsAny<CommandFlags>()))
            .Callback<RedisKey, RedisValue, When, CommandFlags>(
                (_, value, _, _) => listPayloads?.Add(value.ToString()))
            .ReturnsAsync(1L);

        database
            .Setup(x => x.PublishAsync(
                It.IsAny<RedisChannel>(), It.IsAny<RedisValue>(), It.IsAny<CommandFlags>()))
            .Callback<RedisChannel, RedisValue, CommandFlags>(
                (_, value, _) => publishedPayloads?.Add(value.ToString()))
            .ReturnsAsync(1L);

        return database;
    }

    private static RedisMessageProducer CreateSut(Mock<IDatabase> database)
    {
        var client = new Mock<IRedisClient>();
        client.Setup(x => x.GetDatabase()).Returns(database.Object);

        return new RedisMessageProducer(client.Object, NullLogger<RedisMessageProducer>.Instance);
    }

    private static void VerifyListPush(Mock<IDatabase> database, string topic, Times times) =>
        database.Verify(
            x => x.ListRightPushAsync(
                It.Is<RedisKey>(key => key == topic),
                It.IsAny<RedisValue>(),
                It.IsAny<When>(),
                It.IsAny<CommandFlags>()),
            times);

    private static void VerifyPublish(Mock<IDatabase> database, Times times) =>
        database.Verify(
            x => x.PublishAsync(It.IsAny<RedisChannel>(), It.IsAny<RedisValue>(), It.IsAny<CommandFlags>()),
            times);

    private static void AssertInjectedPayload(string payload, string expectedTraceParent)
    {
        using var document = JsonDocument.Parse(payload);
        var root = document.RootElement;

        Assert.Equal(expectedTraceParent, root.GetProperty(JsonTraceContext.TraceParentProperty).GetString());
        Assert.Equal("message", root.GetProperty("id").GetString());
        Assert.Equal("env-1", root.GetProperty("envId").GetString());
    }

    private static IDisposable Listen()
    {
        ActivityCorrelation.RemoveListener();
        ActivityCorrelation.EnsureListener();

        return new Cleanup();
    }

    private sealed class Cleanup : IDisposable
    {
        public void Dispose() => ActivityCorrelation.RemoveListener();
    }
}
