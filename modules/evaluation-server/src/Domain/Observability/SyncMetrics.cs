#nullable enable

using System.Diagnostics.Metrics;

namespace Domain.Observability;

/// <summary>
/// M7 — data-sync payload instrumentation.
/// </summary>
/// <remarks>
/// <para>
/// Every SDK client asks for a payload the moment it connects, and again for every flag or segment
/// change it is affected by. Building one means reading the store, parsing every flag, and — for
/// client-side SDKs — evaluating every flag for that user. It is the most expensive thing the
/// evaluation server does per connection, and it was entirely unmeasured: a bootstrap that had
/// degraded from 20&#160;ms to 2&#160;s was visible only as unhappy customers.
/// </para>
/// <para>
/// <b>The three dimensions are chosen to separate the causes that actually differ.</b>
/// <c>operation</c> distinguishes a full bootstrap from an incremental patch — they differ by
/// orders of magnitude in cost, so averaging them together produces a number that describes
/// neither. <c>connection_type</c> separates client SDKs (which pay for evaluation) from server
/// SDKs (which do not) and from relay proxies (which fan out across every environment they front).
/// <c>outcome</c> separates a slow payload from a failed one.
/// </para>
/// <para>
/// <b><see cref="PayloadItems"/> is what makes the duration interpretable.</b> A bootstrap is slow
/// either because the store is slow or because the environment now has 4,000 flags in it. Without
/// the item count those two look the same, and they have completely different remedies.
/// </para>
/// <para>
/// Item counts are read with <c>TryGetNonEnumeratedCount</c> and the measurement is skipped when
/// that fails. The payload collections are typed as <c>IEnumerable</c>, and enumerating one purely
/// to count it could re-run a lazy sequence — instrumentation must never change what the caller
/// observes.
/// </para>
/// </remarks>
public sealed class SyncMetrics
{
    private SyncMetrics(Meter meter, string instrumentPrefix)
    {
        Meter = meter;

        Payloads = meter.CreateCounter<long>(
            $"{instrumentPrefix}sync.payloads",
            unit: "{payload}",
            description:
            "Data-sync payloads built, by sync type, connection type and outcome. Covers both the " +
            "initial bootstrap and every incremental patch pushed after a change.");

        Duration = meter.CreateHistogram<double>(
            $"{instrumentPrefix}sync.duration",
            unit: "ms",
            description:
            "Time spent building a data-sync payload, including store reads and — for client-side " +
            "SDKs — evaluating every flag for the connected user.");

        PayloadItems = meter.CreateHistogram<int>(
            $"{instrumentPrefix}sync.payload_items",
            unit: "{item}",
            description:
            "Number of flags and segments in a data-sync payload. Reported alongside the duration so " +
            "a slow store can be told apart from a large environment.");
    }

    /// <summary>The instrumentation in use for the running service.</summary>
    public static SyncMetrics Current { get; } =
        new(new Meter(FeatBitMeters.EvaluationServer), FeatBitInstruments.EvaluationServerPrefix);

    /// <summary>The owning meter. Exposed so tests can listen to this instance specifically.</summary>
    public Meter Meter { get; }

    /// <summary>Counter of data-sync payloads built.</summary>
    public Counter<long> Payloads { get; }

    /// <summary>Distribution of payload build durations.</summary>
    public Histogram<double> Duration { get; }

    /// <summary>Distribution of the number of items in a payload.</summary>
    public Histogram<int> PayloadItems { get; }

    /// <summary>
    /// <c>operation</c> value for a full bootstrap served over HTTP rather than the WebSocket.
    /// </summary>
    /// <remarks>
    /// HTTP polling and streaming sync are deliberately separate <c>operation</c> values rather
    /// than one merged series. They are served by different transports with different costs and
    /// different failure modes, and a deployment can shift between them without any code change —
    /// so merging them would hide exactly the migration an operator most needs to see.
    /// </remarks>
    public const string HttpFullOperation = "http_full";

    /// <summary><c>operation</c> value for an incremental patch served over HTTP.</summary>
    public const string HttpPatchOperation = "http_patch";

    /// <summary>Records one data-sync payload build.</summary>
    /// <param name="operation">The sync type, e.g. <c>full</c> or <c>patch</c>.</param>
    /// <param name="connectionType">The normalized connection type.</param>
    /// <param name="outcome">One of <see cref="Outcomes"/>.</param>
    /// <param name="duration">How long the payload took to build.</param>
    /// <param name="itemCount">
    /// The number of flags and segments in the payload, or <c>null</c> when it could not be
    /// determined without enumerating a lazy sequence.
    /// </param>
    public void RecordPayload(
        string operation,
        string connectionType,
        string outcome,
        TimeSpan duration,
        int? itemCount)
    {
        var tags = new[]
        {
            new KeyValuePair<string, object?>(ObservabilityTags.Operation, operation),
            new KeyValuePair<string, object?>(ObservabilityTags.ConnectionType, connectionType),
            new KeyValuePair<string, object?>(ObservabilityTags.Outcome, outcome)
        };

        Payloads.Add(1, tags);
        Duration.Record(duration.TotalMilliseconds, tags);

        if (itemCount.HasValue)
        {
            PayloadItems.Record(itemCount.Value, tags);
        }
    }
}
