using Domain.Messages;

namespace Infrastructure.MQ.Redis;

/// <summary>
/// The single definition of the topics <see cref="RedisMessageConsumer"/> drains, and therefore the
/// topics <see cref="RedisMessageProducer"/> must write as Redis <i>lists</i> rather than publish to
/// pub/sub.
/// </summary>
/// <remarks>
/// <para>
/// The Redis transport is deliberately asymmetric, and the asymmetry is easy to get wrong:
/// </para>
/// <list type="bullet">
///   <item>
///     <description>
///       Topics this service <b>consumes</b> are drained with <c>LPOP</c>, so a producer must reach
///       them with <c>RPUSH</c>. Pub/sub delivers only to subscribers connected at publish time, so
///       a message published to a channel nobody is subscribed to is silently discarded.
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
/// Getting this backwards does not fail loudly — it drops the message. That is exactly what
/// happened to <see cref="ControlPlaneTopics.ControlPlaneWebHooks"/>, which the control plane
/// published to a pub/sub channel while this service drained a list of the same name, so webhooks
/// never fired under <c>MqProvider=Redis</c>. Keeping the routing decision and the consumer's
/// subscription list in one place is what stops that recurring.
/// </para>
/// </remarks>
public static class RedisConsumerTopics
{
    public static readonly string[] All =
    [
        Topics.EndUser,
        Topics.Insights,
        Topics.Usage,
        ControlPlaneTopics.ControlPlaneWebHooks
    ];

    /// <summary>
    /// Whether <paramref name="topic"/> is drained as a list by this service, and so must be
    /// produced with <c>RPUSH</c> instead of <c>PUBLISH</c>.
    /// </summary>
    public static bool IsQueue(string topic) => Array.IndexOf(All, topic) >= 0;
}
