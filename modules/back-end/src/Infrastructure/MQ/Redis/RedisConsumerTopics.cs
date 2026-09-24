using Domain.Messages;

namespace Infrastructure.MQ.Redis;

/// <summary>
/// The single definition of the topics a FeatBit service drains as a Redis <i>list</i>, and
/// therefore the topics <see cref="RedisMessageProducer"/> must reach with <c>RPUSH</c> rather
/// than publish to pub/sub.
/// </summary>
/// <remarks>
/// <para>
/// The Redis transport is deliberately asymmetric, and the asymmetry is easy to get wrong:
/// </para>
/// <list type="bullet">
///   <item>
///     <description>
///       Topics drained with <c>LPOP</c> must be reached with <c>RPUSH</c>. Pub/sub delivers only
///       to subscribers connected at publish time, so a message published to a channel nobody is
///       subscribed to is silently discarded.
///     </description>
///   </item>
///   <item>
///     <description>
///       Every other topic is consumed by the evaluation server through a pub/sub subscription, so
///       it must be reached with <c>PUBLISH</c>.
///     </description>
///   </item>
/// </list>
/// <para>
/// Getting this backwards does not fail loudly — it drops the message. That has now happened
/// twice. First to <see cref="ControlPlaneTopics.ControlPlaneWebHooks"/>, which the control plane
/// published to a pub/sub channel while the back-end drained a list of the same name, so webhooks
/// never fired under <c>MqProvider=Redis</c>. Then to every topic in
/// <see cref="ControlPlaneTopics.Consumed"/>: the control plane registers the back-end's
/// list-based consumer for them, but they were absent from this routing table, so the producer
/// published them to channels nobody subscribed to and <b>the control plane received nothing at
/// all</b> — flag changes simply never propagated under <c>MqProvider=Redis</c>.
/// </para>
/// <para>
/// The second occurrence is why <see cref="All"/> is now composed rather than hand-listed. A
/// service that drains topics as lists declares them in one place, and both its consumer
/// registration and this routing table read that same declaration, so the two cannot drift apart.
/// Adding a topic to <see cref="ControlPlaneTopics.Consumed"/> routes it correctly by
/// construction.
/// </para>
/// </remarks>
public static class RedisConsumerTopics
{
    /// <summary>
    /// The topics the back-end API itself drains as a list. This is what its own
    /// <see cref="RedisMessageConsumer"/> subscribes to — it must <b>not</b> be
    /// <see cref="All"/>, which additionally covers topics a different service drains.
    /// </summary>
    public static readonly string[] BackEnd =
    [
        Topics.EndUser,
        Topics.Insights,
        Topics.Usage,
        ControlPlaneTopics.ControlPlaneWebHooks
    ];

    /// <summary>
    /// Every topic drained as a list by any FeatBit service, and so the complete set the producer
    /// must reach with <c>RPUSH</c>. Routing is a property of the <i>destination</i>, not of the
    /// publishing service, so this is a union: the back-end publishes control-plane topics it
    /// never consumes, and the control plane publishes
    /// <see cref="ControlPlaneTopics.ControlPlaneWebHooks"/> back to the back-end.
    /// </summary>
    public static readonly string[] All = [.. BackEnd, .. ControlPlaneTopics.Consumed];

    /// <summary>
    /// Whether <paramref name="topic"/> is drained as a list by the service that consumes it, and
    /// so must be produced with <c>RPUSH</c> instead of <c>PUBLISH</c>.
    /// </summary>
    public static bool IsQueue(string topic) => Array.IndexOf(All, topic) >= 0;
}
