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
    /// Starts the root activity for handling one consumed message.
    /// </summary>
    /// <param name="topic">Topic the message was read from.</param>
    /// <param name="system">Transport that delivered it.</param>
    /// <returns>
    /// The activity, or <c>null</c> if nothing is listening. Dispose it when handling completes —
    /// <c>using var</c> at the call site is enough, and a null result makes that a no-op.
    /// </returns>
    /// <remarks>
    /// Started with no parent so each message gets its own trace. Trace context is not carried on
    /// the wire today, so linking to the producer's trace is not yet possible; the derived
    /// <see cref="ChangeId"/> is what ties the producing and consuming services together until it is.
    /// </remarks>
    public static Activity? StartConsume(string topic, string system)
    {
        var activity = FeatBitActivitySources.Ingress.StartActivity(
            ConsumeActivityName,
            ActivityKind.Consumer,
            parentContext: default);

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
