#nullable enable

using System.Diagnostics;
using System.Diagnostics.Metrics;

namespace Domain.Observability;

/// <summary>
/// M2 — message-queue publish and consume instrumentation, recorded by the transport adapters.
/// </summary>
/// <remarks>
/// <para>
/// <b>Instrumented at the adapter, not the caller.</b> There are three transports (Kafka, Redis,
/// Postgres) and many callers. Recording at the caller would mean every new publish site had to
/// remember to instrument itself, and would make the <c>provider</c> attribute unavailable. At the
/// adapter, coverage is complete by construction and a new caller is instrumented for free.
/// </para>
/// <para>
/// <b>A successful publish is reported as <see cref="Outcomes.Enqueued"/>, never
/// <c>success</c>.</b> Every producer here is fire-and-forget — Kafka calls <c>Produce()</c>
/// without awaiting a delivery report, and all three swallow publish exceptions — so the strongest
/// honest claim is that the message was handed to the transport. Reporting <c>success</c> would
/// assert a delivery guarantee the code does not provide, and an operator trusting it would draw
/// the wrong conclusion during an incident. Upgrading this to real confirmation is a behavior
/// change (follow-up F5).
/// </para>
/// <para>
/// <b>Backlog is sampled, never measured on a request path.</b> Reading queue depth costs a round
/// trip to Redis, Postgres, or Kafka, so <see cref="RegisterBacklogGauge"/> takes a provider that a
/// background sampler refreshes; the gauge callback only reads a cached value.
/// </para>
/// <para>
/// Attributes are limited to <c>provider</c>, <c>destination</c> (the topic, drawn from the fixed
/// <c>Topics</c> constants), <c>outcome</c>, and <c>error_type</c>. No payload, key, or environment
/// identifier is ever recorded — see <c>docs/observability/index.md</c> §4.
/// </para>
/// </remarks>
public sealed class MessagingMetrics
{
    private static MessagingMetrics _current =
        new(new Meter(FeatBitMeters.Api), FeatBitInstruments.ApiPrefix);

    private readonly string _instrumentPrefix;

    private MessagingMetrics(Meter meter, string instrumentPrefix)
    {
        Meter = meter;
        _instrumentPrefix = instrumentPrefix;

        Published = meter.CreateCounter<long>(
            $"{instrumentPrefix}messaging.published",
            unit: "{message}",
            description:
            "Messages handed to a message-queue transport, by provider, destination, and outcome. " +
            "outcome=enqueued means accepted by the transport, not confirmed delivered.");

        PublishDuration = meter.CreateHistogram<double>(
            $"{instrumentPrefix}messaging.publish_duration",
            unit: "ms",
            description: "Time spent in the publish call, by provider, destination, and outcome.");

        Consumed = meter.CreateCounter<long>(
            $"{instrumentPrefix}messaging.consumed",
            unit: "{message}",
            description: "Messages consumed, by provider, destination, and outcome.");

        ConsumeDuration = meter.CreateHistogram<double>(
            $"{instrumentPrefix}messaging.consume_duration",
            unit: "ms",
            description: "Time spent handling one consumed message, by provider, destination, and outcome.");

        Unroutable = meter.CreateCounter<long>(
            $"{instrumentPrefix}messaging.unroutable",
            unit: "{message}",
            description:
            "Messages received for a topic with no registered handler. Non-zero means a topic is " +
            "being published that this service silently discards.");

        DeliveryFailures = meter.CreateCounter<long>(
            $"{instrumentPrefix}messaging.delivery_failures",
            unit: "{message}",
            description:
            "Broker-reported delivery failures arriving after the publish call returned. Separate " +
            "from published{outcome=failure}, which only covers synchronous failures.");

        Redelivered = meter.CreateCounter<long>(
            $"{instrumentPrefix}messaging.redelivered",
            unit: "{message}",
            description:
            "Messages delivered to a handler more than once, by provider and destination. Only " +
            "reported by transports that track a per-message delivery count.");
    }

    /// <summary>The instrumentation in use for the running service.</summary>
    public static MessagingMetrics Current => _current;

    /// <summary>The owning meter. Exposed so tests can listen to this instance specifically.</summary>
    public Meter Meter { get; }

    /// <summary>Counter of messages handed to a transport.</summary>
    public Counter<long> Published { get; }

    /// <summary>Distribution of publish-call durations.</summary>
    public Histogram<double> PublishDuration { get; }

    /// <summary>Counter of consumed messages.</summary>
    public Counter<long> Consumed { get; }

    /// <summary>Distribution of per-message handling durations.</summary>
    public Histogram<double> ConsumeDuration { get; }

    /// <summary>Counter of messages received for a topic with no registered handler.</summary>
    public Counter<long> Unroutable { get; }

    /// <summary>
    /// Counter of asynchronous, broker-reported delivery failures. Kept separate from
    /// <see cref="Published"/> because these arrive after the publish call has already returned and
    /// been counted as enqueued — folding them together would double-count the message.
    /// </summary>
    public Counter<long> DeliveryFailures { get; }

    /// <summary>
    /// Counter of messages handed to a handler more than once.
    /// </summary>
    /// <remarks>
    /// Only meaningful for transports that persist a per-message delivery count. Under Postgres a
    /// redelivery means an earlier attempt claimed the message and never completed it — a crash,
    /// or a handler that outran the visibility timeout — so a rising count is the signal that work
    /// is being repeated, which matters when handlers are not idempotent. Kafka and Redis do not
    /// track a per-message count and never report on this instrument, so its absence for those
    /// providers is expected rather than a gap.
    /// </remarks>
    public Counter<long> Redelivered { get; }

    /// <summary>
    /// Points the instrumentation at <paramref name="meterName"/> and
    /// <paramref name="instrumentPrefix"/>. Call once during startup, before any message is
    /// published or consumed.
    /// </summary>
    /// <remarks>
    /// This assembly is shared by two hosts, so the service name cannot be baked in at the point an
    /// instrument is created. Reconfiguring after listeners have attached would orphan them, which
    /// is why this is a startup-only call; it is a no-op if the meter name is unchanged.
    /// </remarks>
    public static void Configure(string meterName, string instrumentPrefix)
    {
        if (string.IsNullOrWhiteSpace(meterName) || string.IsNullOrWhiteSpace(instrumentPrefix))
        {
            return;
        }

        if (meterName == _current.Meter.Name && instrumentPrefix == _current._instrumentPrefix)
        {
            return;
        }

        var previous = _current;
        _current = new MessagingMetrics(new Meter(meterName), instrumentPrefix);
        previous.Meter.Dispose();
    }

    /// <summary>
    /// Registers a backlog gauge for one <paramref name="destination"/>.
    /// <paramref name="depthProvider"/> must be a cheap, non-blocking read of a value refreshed by a
    /// background sampler — never a live query.
    /// </summary>
    public void RegisterBacklogGauge(string provider, string destination, Func<long> depthProvider)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(provider);
        ArgumentException.ThrowIfNullOrWhiteSpace(destination);
        ArgumentNullException.ThrowIfNull(depthProvider);

        var tags = new[]
        {
            new KeyValuePair<string, object?>(ObservabilityTags.Provider, provider),
            new KeyValuePair<string, object?>(ObservabilityTags.Destination, destination)
        };

        Meter.CreateObservableGauge(
            $"{_instrumentPrefix}messaging.backlog",
            () => new Measurement<long>(depthProvider(), tags),
            unit: "{message}",
            description: "Messages awaiting consumption, sampled in the background. -1 when unknown.");
    }

    /// <summary>
    /// Times a publish and records its outcome. Returns a scope; call
    /// <see cref="PublishScope.Enqueued"/> when the transport accepts the message and
    /// <see cref="PublishScope.Failed"/> when it throws. A scope disposed without either is recorded
    /// as a failure, so a missed call cannot masquerade as a success.
    /// </summary>
    public PublishScope BeginPublish(string provider, string destination)
        => new(this, provider, destination);

    /// <summary>
    /// Times the handling of one consumed message and records its outcome. Same
    /// fail-closed semantics as <see cref="BeginPublish"/>.
    /// </summary>
    public ConsumeScope BeginConsume(string provider, string destination)
        => new(this, provider, destination);

    /// <summary>Records a message received for a topic with no registered handler.</summary>
    public void RecordUnroutable(string provider, string destination)
        => Unroutable.Add(
            1,
            new KeyValuePair<string, object?>(ObservabilityTags.Provider, provider),
            new KeyValuePair<string, object?>(ObservabilityTags.Destination, destination));

    /// <summary>Records an asynchronous, broker-reported delivery failure.</summary>
    public void RecordDeliveryFailure(string provider, string destination)
        => DeliveryFailures.Add(
            1,
            new KeyValuePair<string, object?>(ObservabilityTags.Provider, provider),
            new KeyValuePair<string, object?>(ObservabilityTags.Destination, destination));

    /// <summary>
    /// Records <paramref name="count"/> messages that were delivered more than once. Callers pass
    /// only genuine redeliveries; a first delivery must not be counted.
    /// </summary>
    public void RecordRedelivered(string provider, string destination, long count = 1)
    {
        if (count <= 0)
        {
            return;
        }

        Redelivered.Add(
            count,
            new KeyValuePair<string, object?>(ObservabilityTags.Provider, provider),
            new KeyValuePair<string, object?>(ObservabilityTags.Destination, destination));
    }

    private static KeyValuePair<string, object?>[] Tags(string provider, string destination, string outcome)
        =>
        [
            new(ObservabilityTags.Provider, provider),
            new(ObservabilityTags.Destination, destination),
            new(ObservabilityTags.Outcome, outcome)
        ];

    private static KeyValuePair<string, object?>[] Tags(
        string provider, string destination, string outcome, string errorType)
        =>
        [
            new(ObservabilityTags.Provider, provider),
            new(ObservabilityTags.Destination, destination),
            new(ObservabilityTags.Outcome, outcome),
            new(ObservabilityTags.ErrorType, errorType)
        ];

    /// <summary>Times one publish. Created by <see cref="BeginPublish"/>.</summary>
    public struct PublishScope : IDisposable
    {
        /// <summary>
        /// Duration at or above which a publish span is always retained. A publish is a single
        /// round trip to the broker, so a second means the broker or the network is the problem.
        /// </summary>
        private const double SlowPublishThresholdMs = 1_000d;

        private readonly MessagingMetrics _owner;
        private readonly string _provider;
        private readonly string _destination;
        private readonly long _startedTimestamp;
        private TailSampledTrace _trace;
        private string _outcome;
        private string? _errorType;
        private bool _completed;

        internal PublishScope(MessagingMetrics owner, string provider, string destination)
        {
            _owner = owner;
            _provider = provider;
            _destination = destination;
            _startedTimestamp = Stopwatch.GetTimestamp();
            _outcome = Outcomes.Failure;
            _errorType = null;
            _completed = false;

            // Closes F16. Every MQ publish in all three services funnels through this scope, so
            // wiring the category here covers all 12 call sites and cannot be forgotten by the
            // thirteenth. The consume side is deliberately not duplicated: the six consumers
            // already start an ingress activity, and a second span around the same work would
            // report the same duration twice under two names.
            _trace = TailSampledTrace.Start(
                TraceCategories.Messaging, "messaging.publish", ActivityKind.Producer,
                SlowPublishThresholdMs);

            _trace.SetTag(ObservabilityTags.Provider, provider);
            _trace.SetTag(ObservabilityTags.Destination, destination);
        }

        /// <summary>Marks the message as accepted by the transport.</summary>
        public void Enqueued() => _outcome = Outcomes.Enqueued;

        /// <summary>Marks the publish as failed, tagged by exception type.</summary>
        public void Failed(Exception? exception)
        {
            _outcome = Outcomes.Failure;
            _errorType = exception?.GetType().Name ?? "Unknown";
        }

        /// <summary>Records the outcome and duration.</summary>
        public void Dispose()
        {
            if (_owner is null || _completed)
            {
                return;
            }

            _completed = true;

            // Enqueued, not Success: the transports are fire-and-forget, so this span can only
            // attest that the broker accepted the message. See F5.
            if (_outcome == Outcomes.Enqueued)
            {
                _trace.Success(Outcomes.Enqueued);
            }
            else
            {
                _trace.Ended(_outcome, _errorType ?? _outcome);
            }

            _trace.Dispose();

            var tags = _errorType is null
                ? Tags(_provider, _destination, _outcome)
                : Tags(_provider, _destination, _outcome, _errorType);

            _owner.Published.Add(1, tags);
            _owner.PublishDuration.Record(Stopwatch.GetElapsedTime(_startedTimestamp).TotalMilliseconds, tags);
        }
    }

    /// <summary>Times the handling of one consumed message. Created by <see cref="BeginConsume"/>.</summary>
    public struct ConsumeScope : IDisposable
    {
        private readonly MessagingMetrics _owner;
        private readonly string _provider;
        private readonly string _destination;
        private readonly long _startedTimestamp;
        private string _outcome;
        private string? _errorType;
        private bool _completed;

        internal ConsumeScope(MessagingMetrics owner, string provider, string destination)
        {
            _owner = owner;
            _provider = provider;
            _destination = destination;
            _startedTimestamp = Stopwatch.GetTimestamp();
            _outcome = Outcomes.Failure;
            _errorType = null;
            _completed = false;
        }

        /// <summary>Marks the message as handled successfully.</summary>
        public void Succeeded() => _outcome = Outcomes.Success;

        /// <summary>Marks handling as failed, tagged by exception type.</summary>
        public void Failed(Exception? exception)
        {
            _outcome = Outcomes.Failure;
            _errorType = exception?.GetType().Name ?? "Unknown";
        }

        /// <summary>
        /// Marks the message as deliberately not handled — for example a shutdown cancellation.
        /// Distinguished from a failure so that a rolling restart does not look like an outage.
        /// </summary>
        public void Cancelled() => _outcome = Outcomes.Rejected;

        /// <summary>Records the outcome and duration.</summary>
        public void Dispose()
        {
            if (_owner is null || _completed)
            {
                return;
            }

            _completed = true;

            var tags = _errorType is null
                ? Tags(_provider, _destination, _outcome)
                : Tags(_provider, _destination, _outcome, _errorType);

            _owner.Consumed.Add(1, tags);
            _owner.ConsumeDuration.Record(Stopwatch.GetElapsedTime(_startedTimestamp).TotalMilliseconds, tags);
        }
    }
}
