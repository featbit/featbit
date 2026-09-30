#nullable enable

using System.Diagnostics;

namespace Domain.Observability;

/// <summary>
/// Starts the root <see cref="Activity"/> for work entering the process, so that everything logged
/// while handling it shares one trace identifier.
/// </summary>
/// <remarks>
/// <para>
/// These activities are <b>not</b> gated by <see cref="TraceGate"/>. The gate governs optional
/// diagnostic spans; these exist to make logs correlatable, which must hold whether or not tracing
/// is switched on. With only the propagation-only listener from
/// <see cref="ActivityCorrelation.EnsureListener"/> attached, the activity is created and carries
/// identifiers but records nothing, so the cost is one allocation per unit of ingress work.
/// </para>
/// <para>
/// HTTP requests need nothing here: ASP.NET Core already starts a request activity, and it carries
/// the caller's <c>traceparent</c> when one is sent. Message-queue consumes have no such ambient
/// activity, which is why they must start one explicitly.
/// </para>
/// </remarks>
public static class IngressActivity
{
    /// <summary>Activity name for a message-queue consume.</summary>
    public const string ConsumeActivityName = "mq.consume";

    /// <summary>Tag naming the topic a message was consumed from.</summary>
    public const string TopicTag = "messaging.destination.name";

    /// <summary>Tag naming the messaging transport (<c>kafka</c>, <c>redis</c>, <c>postgres</c>).</summary>
    public const string SystemTag = "messaging.system";

    /// <summary>
    /// Starts the root activity for handling one consumed message, with no remote parent.
    /// </summary>
    /// <param name="topic">Topic the message was read from.</param>
    /// <param name="system">Transport that delivered it.</param>
    /// <returns>
    /// The activity, or <c>null</c> if nothing is listening. Dispose it when handling completes —
    /// <c>using var</c> at the call site is enough, and a null result makes that a no-op.
    /// </returns>
    /// <remarks>
    /// Each message gets its own trace. Every FeatBit transport now carries trace context on the
    /// wire — Kafka in headers, Postgres in columns, Redis as payload properties — so production
    /// consume paths call the overload taking an <see cref="ActivityContext"/>. This one remains
    /// for callers that genuinely have no parent to offer, and is what the other overload degrades
    /// to when a message carries no context, which is the case for anything produced before trace
    /// context existed.
    /// </remarks>
    public static Activity? StartConsume(string topic, string system)
        => StartConsume(topic, system, default);

    /// <summary>
    /// Starts the root activity for handling one consumed message, continuing the producer's trace
    /// when the transport carried one.
    /// </summary>
    /// <param name="topic">Topic the message was read from.</param>
    /// <param name="system">Transport that delivered it.</param>
    /// <param name="parentContext">
    /// Trace context extracted from the message, from
    /// <see cref="TraceContextPropagation.Extract"/>. Pass <see langword="default"/> when the
    /// message carried none — that starts a fresh trace, which is the behavior every transport had
    /// before trace context was propagated at all.
    /// </param>
    /// <returns>
    /// The activity, or <c>null</c> if nothing is listening. Dispose it when handling completes.
    /// </returns>
    public static Activity? StartConsume(string topic, string system, ActivityContext parentContext)
    {
        var activity = FeatBitActivitySources.Ingress.StartActivity(
            ConsumeActivityName,
            ActivityKind.Consumer,
            parentContext);

        if (activity is not null)
        {
            activity.SetTag(TopicTag, topic);
            activity.SetTag(SystemTag, system);
        }

        return activity;
    }
}

/// <summary>Messaging transport names used for <see cref="IngressActivity.SystemTag"/>.</summary>
public static class MessagingSystems
{
    /// <summary>Apache Kafka.</summary>
    public const string Kafka = "kafka";

    /// <summary>Redis, used as either a list queue or a pub/sub channel.</summary>
    public const string Redis = "redis";

    /// <summary>PostgreSQL, used as a polled queue table.</summary>
    public const string Postgres = "postgres";
}
