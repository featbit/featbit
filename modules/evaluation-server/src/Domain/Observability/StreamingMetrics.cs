#nullable enable

using System.Diagnostics.Metrics;

namespace Domain.Observability;

/// <summary>
/// M1 — WebSocket streaming instrumentation for the evaluation server.
/// </summary>
/// <remarks>
/// <para>
/// <b>Sockets and subscriptions are counted separately, on purpose.</b> A relay-proxy connection
/// opens one socket but registers one logical subscription per mapped environment secret, so the
/// two numbers legitimately differ by a large factor. Reporting only one of them makes a relay-proxy
/// deployment either look under-connected (sockets) or wildly over-connected (subscriptions).
/// Reporting both makes the ratio itself a diagnostic: a sudden divergence means secret mapping
/// changed.
/// </para>
/// <para>
/// <b>Gauge callbacks never scan the connection dictionary.</b> The socket count is an interlocked
/// counter and the subscription count is <c>ConcurrentDictionary.Count</c>. A callback that
/// enumerated connections would take locks on the hot path of every collection interval, which is
/// exactly the sort of instrumentation that becomes the incident.
/// </para>
/// <para>
/// <b>Rejections are counted where they are decided, not inferred.</b> A handshake that is accepted
/// only to be closed with 4003 is a rejection, even though the WebSocket upgrade itself succeeded —
/// so <see cref="RecordUpgrade"/> is called with the validation outcome rather than the HTTP status.
/// </para>
/// <para>
/// Attributes are limited to <c>connection_type</c>, <c>outcome</c>, and <c>reason</c>, all drawn
/// from fixed sets. Tokens, environment identifiers, and client addresses are never recorded — see
/// <c>docs/observability/index.md</c> §4.
/// </para>
/// </remarks>
public sealed class StreamingMetrics
{
    private long _activeSockets;
    private Func<long>? _subscriptionCountProvider;

    private StreamingMetrics(Meter meter, string instrumentPrefix)
    {
        Meter = meter;

        Upgrades = meter.CreateCounter<long>(
            $"{instrumentPrefix}streaming.upgrades",
            unit: "{connection}",
            description:
            "WebSocket upgrade attempts by connection type and outcome. outcome=rejected covers " +
            "requests that were accepted purely to deliver a 4003 close.");

        Closed = meter.CreateCounter<long>(
            $"{instrumentPrefix}streaming.closed",
            unit: "{connection}",
            description: "Streaming connections closed, by connection type and close reason.");

        ConnectionDuration = meter.CreateHistogram<double>(
            $"{instrumentPrefix}streaming.connection_duration",
            unit: "s",
            description:
            "Lifetime of a streaming connection, by connection type and close reason. Recorded in " +
            "seconds because healthy connections are long-lived.");

        meter.CreateObservableGauge(
            $"{instrumentPrefix}streaming.active_sockets",
            () => Interlocked.Read(ref _activeSockets),
            unit: "{connection}",
            description: "Currently open streaming WebSockets. One per client, regardless of mapped secrets.");

        meter.CreateObservableGauge(
            $"{instrumentPrefix}streaming.subscriptions",
            ObserveSubscriptions,
            unit: "{subscription}",
            description:
            "Currently registered logical connections. A relay proxy registers one per mapped " +
            "environment, so this exceeds active_sockets whenever relay proxies are connected.");

        Messages = meter.CreateCounter<long>(
            $"{instrumentPrefix}streaming.messages",
            unit: "{message}",
            description:
            "Inbound messages handled on an established connection, by message type and outcome. " +
            "operation is 'unknown' for any type with no registered handler, so it cannot be " +
            "inflated by arbitrary values from the wire.");

        MessageDuration = meter.CreateHistogram<double>(
            $"{instrumentPrefix}streaming.message_duration",
            unit: "ms",
            description:
            "Time spent handling one inbound message, by message type and outcome. A data-sync " +
            "message builds a whole payload, so this is where a slow bootstrap surfaces per-message.");

        ReceivedMessageSize = meter.CreateHistogram<int>(
            $"{instrumentPrefix}streaming.received_message_size",
            unit: "By",
            description:
            "Size of an inbound message after fragment reassembly, by message type and outcome. " +
            "Recorded for rejected messages too, so an oversized or malformed client can be told " +
            "apart from a merely chatty one.");

        SentMessageSize = meter.CreateHistogram<int>(
            $"{instrumentPrefix}streaming.sent_message_size",
            unit: "By",
            description:
            "Size of an outbound message as sent on the socket, by message type. The data-sync " +
            "message type carries the serialized sync payload, so this is the payload size on the " +
            "wire rather than an estimate.");
    }

    /// <summary>The instrumentation in use for the running service.</summary>
    public static StreamingMetrics Current { get; } =
        new(new Meter(FeatBitMeters.EvaluationServer), FeatBitInstruments.EvaluationServerPrefix);

    /// <summary>The owning meter. Exposed so tests can listen to this instance specifically.</summary>
    public Meter Meter { get; }

    /// <summary>Counter of WebSocket upgrade attempts.</summary>
    public Counter<long> Upgrades { get; }

    /// <summary>Counter of closed streaming connections.</summary>
    public Counter<long> Closed { get; }

    /// <summary>Distribution of streaming connection lifetimes, in seconds.</summary>
    public Histogram<double> ConnectionDuration { get; }

    /// <summary>Counter of inbound messages handled on established connections.</summary>
    public Counter<long> Messages { get; }

    /// <summary>Distribution of inbound message handling durations.</summary>
    public Histogram<double> MessageDuration { get; }

    /// <summary>Distribution of inbound message sizes, in bytes.</summary>
    public Histogram<int> ReceivedMessageSize { get; }

    /// <summary>Distribution of outbound message sizes, in bytes.</summary>
    public Histogram<int> SentMessageSize { get; }

    /// <summary>
    /// Records one inbound message handled on an established connection.
    /// </summary>
    /// <param name="operation">
    /// The message type. Callers <b>must</b> pass <see cref="StreamingReasons.Unknown"/> for a type
    /// with no registered handler: the raw value arrives from the wire and is attacker-controlled,
    /// so passing it through would let a client mint unbounded metric series at will.
    /// </param>
    /// <param name="outcome">One of <see cref="Outcomes"/>.</param>
    /// <param name="reason">One of <see cref="StreamingReasons"/>.</param>
    /// <param name="duration">How long handling took.</param>
    /// <param name="sizeBytes">
    /// The reassembled message size in bytes, or <c>null</c> when it is not available. The bytes
    /// are already materialized by the dispatcher, so this costs a length read rather than a copy.
    /// </param>
    public void RecordMessage(
        string operation,
        string outcome,
        string reason,
        TimeSpan duration,
        int? sizeBytes = null)
    {
        var tags = new[]
        {
            new KeyValuePair<string, object?>(ObservabilityTags.Operation, operation),
            new KeyValuePair<string, object?>(ObservabilityTags.Outcome, outcome),
            new KeyValuePair<string, object?>(ObservabilityTags.Reason, reason)
        };

        Messages.Add(1, tags);
        MessageDuration.Record(duration.TotalMilliseconds, tags);

        if (sizeBytes.HasValue)
        {
            ReceivedMessageSize.Record(sizeBytes.Value, tags);
        }
    }

    /// <summary>
    /// Records one outbound message sent on an established connection.
    /// </summary>
    /// <remarks>
    /// Called from the send path with the bytes the socket is about to write, so it never
    /// serializes anything a second time. <paramref name="operation"/> is safe to tag because every
    /// <c>ServerMessage</c> in the codebase is constructed from a <c>MessageTypes</c> constant —
    /// unlike the inbound direction, no part of it comes off the wire.
    /// </remarks>
    /// <param name="operation">The message type, from the fixed <c>MessageTypes</c> set.</param>
    /// <param name="sizeBytes">The size of the serialized message in bytes.</param>
    public void RecordSentMessage(string operation, int sizeBytes) =>
        SentMessageSize.Record(
            sizeBytes, new KeyValuePair<string, object?>(ObservabilityTags.Operation, operation));

    /// <summary>
    /// Supplies the logical-subscription count. Set once at startup by the connection manager.
    /// Until it is set the gauge reports <em>nothing</em> rather than zero, because "no data" and
    /// "zero connections" are different incidents and must not look alike.
    /// </summary>
    public void SetSubscriptionCountProvider(Func<long> provider)
    {
        ArgumentNullException.ThrowIfNull(provider);
        _subscriptionCountProvider = provider;
    }

    /// <summary>Records the outcome of one WebSocket upgrade attempt.</summary>
    /// <param name="connectionType">
    /// The requested connection type. Callers pass <see cref="StreamingReasons.Unknown"/> when the
    /// request was rejected before a type could be determined.
    /// </param>
    /// <param name="outcome">One of <see cref="Outcomes"/>.</param>
    /// <param name="reason">A value from <see cref="StreamingReasons"/>.</param>
    public void RecordUpgrade(string connectionType, string outcome, string reason)
        => Upgrades.Add(
            1,
            new KeyValuePair<string, object?>(ObservabilityTags.ConnectionType, Normalize(connectionType)),
            new KeyValuePair<string, object?>(ObservabilityTags.Outcome, outcome),
            new KeyValuePair<string, object?>(ObservabilityTags.Reason, reason));

    /// <summary>
    /// Marks a socket as open. Balanced by <see cref="SocketClosed"/>; callers must invoke that from
    /// a <c>finally</c> so an exception on the connection cannot leak the gauge upwards forever.
    /// </summary>
    public void SocketOpened() => Interlocked.Increment(ref _activeSockets);

    /// <summary>
    /// Marks a socket as closed and records its lifetime and close reason.
    /// </summary>
    /// <param name="connectionType">The connection type, from <c>ConnectionType</c>.</param>
    /// <param name="reason">A value from <see cref="StreamingReasons"/>.</param>
    /// <param name="duration">How long the connection was open.</param>
    public void SocketClosed(string connectionType, string reason, TimeSpan duration)
    {
        Interlocked.Decrement(ref _activeSockets);

        var tags = new[]
        {
            new KeyValuePair<string, object?>(ObservabilityTags.ConnectionType, Normalize(connectionType)),
            new KeyValuePair<string, object?>(ObservabilityTags.Reason, reason)
        };

        Closed.Add(1, tags);
        ConnectionDuration.Record(duration.TotalSeconds, tags);
    }

    private IEnumerable<Measurement<long>> ObserveSubscriptions()
    {
        var provider = _subscriptionCountProvider;
        if (provider is null)
        {
            yield break;
        }

        yield return new Measurement<long>(provider());
    }

    /// <summary>
    /// Maps a caller-supplied connection type onto the fixed set <c>client</c> / <c>server</c> /
    /// <c>relay_proxy</c> / <c>unknown</c>.
    /// </summary>
    /// <remarks>
    /// The connection type arrives from a query-string parameter, so passing it through unmodified
    /// would let an arbitrary caller mint unbounded attribute values and blow the cardinality
    /// budget. Public so that spans tag themselves with exactly the same normalized value the
    /// metrics use — a span and a metric disagreeing about the connection type would be worse than
    /// having neither.
    /// </remarks>
    public static string Normalize(string connectionType)
        => connectionType switch
        {
            "client" => "client",
            "server" => "server",
            "relay-proxy" => "relay_proxy",
            _ => StreamingReasons.Unknown
        };
}

/// <summary>
/// The fixed reason vocabulary for streaming upgrades and closes. Values are constants rather than
/// free text precisely so that <c>reason</c> stays inside the cardinality budget.
/// </summary>
public static class StreamingReasons
{
    /// <summary>Not determined — for example a rejection before the connection type was read.</summary>
    public const string Unknown = "unknown";

    /// <summary>The handshake was accepted and the connection processed.</summary>
    public const string Accepted = "accepted";

    /// <summary>Permanently invalid request; closed with 4003 so SDKs stop reconnecting.</summary>
    public const string InvalidRequest = "invalid_request";

    /// <summary>An inbound message on an established connection was not valid JSON.</summary>
    public const string InvalidJson = "invalid_json";

    /// <summary>
    /// An inbound message named a message type with no registered handler. The type itself is
    /// deliberately never used as a tag value — it arrives from the wire and is unbounded.
    /// </summary>
    public const string UnknownType = "unknown_type";

    /// <summary>Transiently unavailable; closed so SDKs retry.</summary>
    public const string Unavailable = "unavailable";

    /// <summary>The peer closed the connection, or its message loop ended normally.</summary>
    public const string ClientClosed = "client_closed";

    /// <summary>The request was aborted by the client or the network.</summary>
    public const string ClientAborted = "client_aborted";

    /// <summary>The host is shutting down.</summary>
    public const string ServerShutdown = "server_shutdown";

    /// <summary>An exception ended the connection.</summary>
    public const string Error = "error";
}
