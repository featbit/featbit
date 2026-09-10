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
    public void IsQueue_ForEveryListConsumedTopic_ReturnsTrue(string topic)
    {
        Assert.Contains(topic, RedisConsumerTopics.All);
        Assert.True(RedisConsumerTopics.IsQueue(topic));
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
    [InlineData(ControlPlaneTopics.ControlPlaneFeatureFlagChange)]
    [InlineData(ControlPlaneTopics.ControlPlaneSegmentChange)]
    [InlineData(ControlPlaneTopics.ControlPlaneSecretChange)]
    [InlineData(ControlPlaneTopics.ControlPlaneLicenseChange)]
    public void IsQueue_ForAPubSubConsumedTopic_ReturnsFalse(string topic)
    {
        Assert.False(RedisConsumerTopics.IsQueue(topic));
    }

    /// <summary>
    /// The evaluation server subscribes to the pattern <c>featbit-*-change</c>. Any topic routed to
    /// a list must not match it, or the message would be pushed to a list while a subscriber sat
    /// waiting on a channel of the same name.
    /// </summary>
    [Fact]
    public void All_ForEveryQueueTopic_DoesNotMatchTheEvaluationServerChangePattern()
    {
        Assert.All(
            RedisConsumerTopics.All,
            topic => Assert.False(
                topic.StartsWith("featbit-", StringComparison.Ordinal) &&
                topic.EndsWith("-change", StringComparison.Ordinal),
                $"'{topic}' is drained as a list but also matches the pub/sub pattern featbit-*-change."));
    }
}
