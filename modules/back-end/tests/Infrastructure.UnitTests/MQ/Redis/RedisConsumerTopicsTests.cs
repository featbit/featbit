using Domain.Messages;
using Infrastructure.MQ.Redis;

namespace Infrastructure.UnitTests.MQ.Redis;

/// <summary>
/// Pins the Redis transport's producer/consumer pairing.
/// </summary>
/// <remarks>
/// <para>
/// The Redis transport is deliberately asymmetric. Topics this service drains with <c>LPOP</c> must
/// be produced with <c>RPUSH</c>; everything else is consumed by the evaluation server through a
/// pub/sub subscription and must be produced with <c>PUBLISH</c>.
/// </para>
/// <para>
/// Getting it backwards does not throw, log, or fail a health check — it silently discards the
/// message, because publishing to a channel with no live subscriber is a no-op in Redis. That is
/// what happened to <c>featbit-control-plane-web-hooks</c>: the control plane published it to a
/// pub/sub channel while the back-end drained a list of the same name, so webhooks never fired
/// under <c>MqProvider=Redis</c>. These tests exist so that regression cannot return unnoticed.
/// </para>
/// </remarks>
public class RedisConsumerTopicsTests
{
    /// <summary>
    /// The defect itself. The control plane publishes webhook notifications through the back-end's
    /// producer, and the back-end drains them with <c>LPOP</c>, so this topic must route to a list.
    /// </summary>
    [Fact]
    public void IsQueue_ForTheControlPlaneWebHooksTopic_ReturnsTrue()
    {
        Assert.True(RedisConsumerTopics.IsQueue(ControlPlaneTopics.ControlPlaneWebHooks));
    }

    [Theory]
    [InlineData(Topics.EndUser)]
    [InlineData(Topics.Insights)]
    [InlineData(Topics.Usage)]
    [InlineData(ControlPlaneTopics.ControlPlaneWebHooks)]
    [InlineData(ControlPlaneTopics.ControlPlaneFeatureFlagChange)]
    [InlineData(ControlPlaneTopics.ControlPlaneSegmentChange)]
    [InlineData(ControlPlaneTopics.ControlPlaneSecretChange)]
    [InlineData(ControlPlaneTopics.ControlPlaneLicenseChange)]
    [InlineData(ControlPlaneTopics.ConnectionMade)]
    [InlineData(ControlPlaneTopics.ConnectionClosed)]
    [InlineData(ControlPlaneTopics.PodHeartbeat)]
    public void IsQueue_ForEveryListConsumedTopic_ReturnsTrue(string topic)
    {
        Assert.Contains(topic, RedisConsumerTopics.All);
        Assert.True(RedisConsumerTopics.IsQueue(topic));
    }

    /// <summary>
    /// The second occurrence of the defect, and the more severe one: the control plane registers
    /// the back-end's list-based consumer for all seven of these, but they were absent from the
    /// routing table, so the producer published them to channels nobody subscribed to. The control
    /// plane received nothing at all and flag changes never propagated under
    /// <c>MqProvider=Redis</c>.
    /// </summary>
    [Fact]
    public void All_ForEveryTopicTheControlPlaneConsumes_ContainsIt()
    {
        Assert.All(
            ControlPlaneTopics.Consumed,
            topic => Assert.True(
                RedisConsumerTopics.IsQueue(topic),
                $"'{topic}' is drained as a list by the control plane but is produced with PUBLISH, " +
                "so the message is silently discarded."));
    }

    /// <summary>
    /// The other half of the contract, and the one a careless "just make them all lists" fix would
    /// break: these topics are consumed by the evaluation server over pub/sub. Pushing them onto a
    /// list instead would stop flag and segment propagation entirely.
    /// </summary>
    [Theory]
    [InlineData(Topics.FeatureFlagChange)]
    [InlineData(Topics.SegmentChange)]
    [InlineData(ControlPlaneTopics.ControlPlaneCommand)]
    public void IsQueue_ForAPubSubConsumedTopic_ReturnsFalse(string topic)
    {
        Assert.False(RedisConsumerTopics.IsQueue(topic));
    }

    /// <summary>
    /// The evaluation server subscribes to the pattern <c>featbit-*-change</c>, but only
    /// <i>handles</i> three topics. A topic it handles must never be routed to a list, or the
    /// message would be pushed somewhere nothing drains while a subscriber sat waiting on a
    /// channel of the same name.
    /// </summary>
    /// <remarks>
    /// This is deliberately phrased against the topics the evaluation server handles rather than
    /// against the pattern itself. The four <c>featbit-control-plane-*-change</c> topics do match
    /// the pattern, but the evaluation server has no handler for them — it logs
    /// <c>No message handler for topic</c> and discards them — so routing them to a list loses
    /// nothing and removes a spurious delivery. Asserting on the pattern would forbid the correct
    /// routing for those four, which is how they came to be misrouted in the first place.
    /// </remarks>
    [Fact]
    public void All_ForEveryQueueTopic_DoesNotCollideWithATopicTheEvaluationServerHandles()
    {
        string[] handledByEvaluationServer =
        [
            Topics.FeatureFlagChange,
            Topics.SegmentChange,
            ControlPlaneTopics.ControlPlaneCommand
        ];

        Assert.All(
            RedisConsumerTopics.All,
            topic => Assert.DoesNotContain(topic, handledByEvaluationServer));
    }

    /// <summary>
    /// The back-end's own consumer must subscribe to its own topics, not to the union. Handing it
    /// <see cref="RedisConsumerTopics.All"/> would make it race the control plane for every
    /// control-plane message and pop messages it has no handler for.
    /// </summary>
    [Fact]
    public void BackEnd_ForEveryTopicTheControlPlaneConsumes_DoesNotContainIt()
    {
        Assert.All(
            ControlPlaneTopics.Consumed,
            topic => Assert.DoesNotContain(topic, RedisConsumerTopics.BackEnd));
    }
}
