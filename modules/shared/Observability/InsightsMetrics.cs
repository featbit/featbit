#nullable enable

using System.Diagnostics.Metrics;

namespace Domain.Observability;

/// <summary>
/// M8 — insights ingestion and persistence instrumentation.
/// </summary>
/// <remarks>
/// <para>
/// Insights are the evaluation and metric events SDKs report back, and they are the input to every
/// experiment result and usage figure the product shows. They travel a long way — SDK → evaluation
/// server → message queue → back-end flush worker → OLAP store — and before this the only thing
/// measured anywhere along it was whether the flush worker's loop was alive.
/// </para>
/// <para>
/// <b>Two ends, two instruments, on purpose.</b> <see cref="Received"/> counts what arrives at the
/// evaluation server; <see cref="Persisted"/> counts what the back-end actually writes. They are
/// deliberately separate names rather than one counter with a stage tag, because comparing them is
/// the entire diagnostic: a sustained gap between received and persisted is silent data loss, and
/// it is exactly the failure that experiment results quietly wrong.
/// </para>
/// <para>
/// <b>Rejected insights were previously invisible.</b> The ingestion endpoint filters on
/// <c>IsValid()</c> and then returns <c>200 OK</c> whether anything survived the filter or not — so
/// an SDK sending malformed events looks identical to one sending none, from both ends. That
/// behaviour is unchanged; it is now counted.
/// </para>
/// <para>
/// <b><see cref="Persisted"/> counts events, not batches.</b> The flush worker's existing worker
/// metrics already count loop iterations and failures. What they cannot say is how much data a
/// failure lost — one failed batch might be 1 event or 10,000. Recording the event count is what
/// turns "a flush failed" into "we dropped 8,400 insights".
/// </para>
/// </remarks>
public sealed class InsightsMetrics
{
    private static InsightsMetrics _current =
        new(new Meter(FeatBitMeters.Api), FeatBitInstruments.ApiPrefix);

    private readonly string _instrumentPrefix;

    private InsightsMetrics(Meter meter, string instrumentPrefix)
    {
        Meter = meter;
        _instrumentPrefix = instrumentPrefix;

        Received = meter.CreateCounter<long>(
            $"{instrumentPrefix}insights.received",
            unit: "{insight}",
            description:
            "Insight events received from SDKs, by outcome. outcome=rejected covers events dropped " +
            "by validation, which the endpoint still answers 200 OK for.");

        Persisted = meter.CreateCounter<long>(
            $"{instrumentPrefix}insights.persisted",
            unit: "{insight}",
            description:
            "Insight events written to the analytics store, by outcome. Counts events rather than " +
            "batches, so a failure reports how much data was actually lost.");

        BatchSize = meter.CreateHistogram<int>(
            $"{instrumentPrefix}insights.batch_size",
            unit: "{insight}",
            description:
            "Number of insight events in one flush batch. Batches pinned at the configured maximum " +
            "mean the flush worker is falling behind the incoming rate.");

        FlushDuration = meter.CreateHistogram<double>(
            $"{instrumentPrefix}insights.flush_duration",
            unit: "ms",
            description: "Time spent persisting one batch of insight events, by outcome.");

        RequestSize = meter.CreateHistogram<long>(
            $"{instrumentPrefix}insights.request_size",
            unit: "By",
            description:
            "Size of an insight ingest request body, taken from Content-Length. Distinguishes a " +
            "few very large requests from many small ones, which have the same event count but " +
            "very different memory and bandwidth profiles.");
    }

    /// <summary>The instrumentation in use for the running service.</summary>
    public static InsightsMetrics Current => _current;

    /// <summary>The owning meter. Exposed so tests can listen to this instance specifically.</summary>
    public Meter Meter { get; }

    /// <summary>Counter of insight events received from SDKs.</summary>
    public Counter<long> Received { get; }

    /// <summary>Counter of insight events written to the analytics store.</summary>
    public Counter<long> Persisted { get; }

    /// <summary>Distribution of flush batch sizes.</summary>
    public Histogram<int> BatchSize { get; }

    /// <summary>Distribution of per-batch persist durations.</summary>
    public Histogram<double> FlushDuration { get; }

    /// <summary>Distribution of ingest request body sizes, in bytes.</summary>
    public Histogram<long> RequestSize { get; }

    /// <summary>
    /// Records the size of one ingest request body.
    /// </summary>
    /// <remarks>
    /// Taken from <c>Content-Length</c>, so it costs a header read and is exact when present.
    /// A chunked request has no length; that is passed as <c>null</c> and skipped rather than
    /// recorded as zero, because a zero-byte sample would drag the distribution down and imply the
    /// opposite of what a chunked upload usually means.
    /// </remarks>
    /// <param name="contentLength">The request's Content-Length, or <c>null</c> when absent.</param>
    public void RecordRequestSize(long? contentLength)
    {
        if (contentLength is >= 0)
        {
            RequestSize.Record(contentLength.Value);
        }
    }

    /// <summary>
    /// Points the instrumentation at <paramref name="meterName"/> and
    /// <paramref name="instrumentPrefix"/>. Call once during startup, before any insight is
    /// received or flushed.
    /// </summary>
    /// <remarks>
    /// Both the evaluation server and the back-end emit these instruments, so the service name
    /// cannot be baked in at the point an instrument is created. It is a no-op if the meter name is
    /// unchanged.
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
        _current = new InsightsMetrics(new Meter(meterName), instrumentPrefix);
        previous.Meter.Dispose();
    }

    /// <summary>Records insight events received from an SDK.</summary>
    /// <param name="outcome">One of <see cref="Outcomes"/>.</param>
    /// <param name="count">How many events. Nothing is recorded when this is not positive.</param>
    public void RecordReceived(string outcome, int count)
    {
        if (count <= 0)
        {
            return;
        }

        Received.Add(count, new KeyValuePair<string, object?>(ObservabilityTags.Outcome, outcome));
    }

    /// <summary>Records one flush batch.</summary>
    /// <param name="outcome">One of <see cref="Outcomes"/>.</param>
    /// <param name="count">How many events were in the batch.</param>
    /// <param name="duration">How long the persist call took.</param>
    public void RecordFlush(string outcome, int count, TimeSpan duration)
    {
        var tag = new KeyValuePair<string, object?>(ObservabilityTags.Outcome, outcome);

        Persisted.Add(count, tag);
        BatchSize.Record(count, tag);
        FlushDuration.Record(duration.TotalMilliseconds, tag);
    }
}
