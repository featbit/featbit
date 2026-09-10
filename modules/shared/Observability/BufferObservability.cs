#nullable enable

using System.Diagnostics;
using System.Diagnostics.Metrics;

namespace Domain.Observability;

/// <summary>
/// Saturation instrumentation for an in-memory buffer (a bounded <c>Channel</c> or equivalent):
/// occupancy, capacity, drops, blocked writers, and time spent waiting to write.
/// </summary>
/// <remarks>
/// <para>
/// <b>The right signal depends on the buffer's full-mode, and getting this wrong hides the
/// problem.</b>
/// </para>
/// <list type="bullet">
///   <item>
///     <description>
///       A <i>dropping</i> buffer (<c>DropOldest</c>/<c>DropWrite</c>) sheds load silently, so
///       <see cref="RecordDropped"/> is the primary signal. Occupancy of such a buffer looks
///       healthy precisely when it is losing data.
///     </description>
///   </item>
///   <item>
///     <description>
///       A <i>waiting</i> buffer (<c>FullMode.Wait</c>) never drops; it back-pressures the calling
///       thread instead. Occupancy simply pins at capacity, so the signal that matters is
///       <see cref="TrackBlockedWriter"/> — blocked writer count and wait duration — because that is
///       what shows up as request latency.
///     </description>
///   </item>
/// </list>
/// <para>
/// <c>occupancyProvider</c> must be a cheap, non-blocking read. For a
/// <c>System.Threading.Channels</c> channel, pass <c>() =&gt; channel.Reader.Count</c>.
/// </para>
/// </remarks>
public sealed class BufferObservability
{
    private readonly KeyValuePair<string, object?>[] _tags;
    private long _blockedWriters;
    private long _bufferedBytes;
    private readonly bool _tracksBytes;

    /// <summary>Registers the buffer instruments on <paramref name="meter"/>.</summary>
    /// <param name="meter">The owning meter.</param>
    /// <param name="instrumentPrefix">Service prefix, e.g. <see cref="FeatBitInstruments.ApiPrefix"/>.</param>
    /// <param name="bufferName">Stable, low-cardinality buffer name, e.g. <c>insights</c>.</param>
    /// <param name="capacity">Configured capacity, or a negative value if unbounded.</param>
    /// <param name="occupancyProvider">Cheap, non-blocking current-item-count read. Optional.</param>
    /// <param name="trackBytes">
    /// Registers <c>buffer.bytes</c> and enables byte accounting. Opt-in: a buffer whose callers do
    /// not supply sizes would otherwise export a constant zero, which reads as "holding no data"
    /// rather than "not measured".
    /// </param>
    public BufferObservability(
        Meter meter,
        string instrumentPrefix,
        string bufferName,
        int capacity,
        Func<int>? occupancyProvider = null,
        bool trackBytes = false)
    {
        ArgumentNullException.ThrowIfNull(meter);
        ArgumentException.ThrowIfNullOrWhiteSpace(instrumentPrefix);
        ArgumentException.ThrowIfNullOrWhiteSpace(bufferName);

        BufferName = bufferName;
        _tags = new[] { new KeyValuePair<string, object?>(ObservabilityTags.Buffer, bufferName) };

        if (occupancyProvider is not null)
        {
            meter.CreateObservableGauge(
                $"{instrumentPrefix}buffer.items",
                () => new Measurement<long>(occupancyProvider(), _tags),
                unit: "{item}",
                description: "Items currently buffered.");
        }

        if (capacity >= 0)
        {
            meter.CreateObservableGauge(
                $"{instrumentPrefix}buffer.capacity",
                () => new Measurement<long>(capacity, _tags),
                unit: "{item}",
                description: "Configured buffer capacity.");
        }

        if (trackBytes)
        {
            _tracksBytes = true;

            meter.CreateObservableGauge(
                $"{instrumentPrefix}buffer.bytes",
                () => new Measurement<long>(Math.Max(0, Interlocked.Read(ref _bufferedBytes)), _tags),
                unit: "By",
                description:
                "Approximate bytes currently buffered, for buffers whose callers already hold a " +
                "serialized form of each item.");
        }

        meter.CreateObservableGauge(
            $"{instrumentPrefix}buffer.blocked_writers",
            () => new Measurement<long>(Interlocked.Read(ref _blockedWriters), _tags),
            unit: "{writer}",
            description: "Callers currently blocked waiting to write, for buffers that apply backpressure.");

        ItemsDropped = meter.CreateCounter<long>(
            $"{instrumentPrefix}buffer.items_dropped",
            unit: "{item}",
            description: "Items discarded because the buffer was full.");

        WriteWait = meter.CreateHistogram<double>(
            $"{instrumentPrefix}buffer.write_wait",
            unit: "ms",
            description: "Time a caller spent blocked waiting to write into the buffer.");
    }

    /// <summary>The buffer's stable name, as reported on the <c>buffer</c> attribute.</summary>
    public string BufferName { get; }

    /// <summary>
    /// Bytes currently buffered — the same value <c>buffer.bytes</c> reports, floored at zero.
    /// Always zero when byte tracking is disabled.
    /// </summary>
    public long BufferedBytes => Math.Max(0, Interlocked.Read(ref _bufferedBytes));

    /// <summary>Counter of items discarded because the buffer was full.</summary>
    public Counter<long> ItemsDropped { get; }

    /// <summary>Distribution of time spent blocked waiting to write.</summary>
    public Histogram<double> WriteWait { get; }

    /// <summary>Records <paramref name="count"/> dropped items.</summary>
    public void RecordDropped(long count = 1)
    {
        if (count > 0)
        {
            ItemsDropped.Add(count, _tags);
        }
    }

    /// <summary>
    /// Adds <paramref name="bytes"/> to the buffered-byte total, for an item that has just been
    /// enqueued. No-op unless the buffer was constructed with byte tracking enabled.
    /// </summary>
    public void AddBytes(long bytes)
    {
        if (_tracksBytes && bytes > 0)
        {
            Interlocked.Add(ref _bufferedBytes, bytes);
        }
    }

    /// <summary>
    /// Subtracts <paramref name="bytes"/> from the buffered-byte total, for an item that has just
    /// been removed. Must be paired with <see cref="AddBytes"/>, or the gauge drifts.
    /// </summary>
    public void RemoveBytes(long bytes)
    {
        if (_tracksBytes && bytes > 0)
        {
            Interlocked.Add(ref _bufferedBytes, -bytes);
        }
    }

    /// <summary>
    /// Marks the caller as blocked for the lifetime of the returned scope, and records the wait
    /// duration on dispose. Wrap the write itself:
    /// <code>
    /// using (buffer.TrackBlockedWriter())
    /// {
    ///     await channel.Writer.WriteAsync(item, ct);
    /// }
    /// </code>
    /// The scope is a struct, so an uncontended write costs no allocation.
    /// </summary>
    public BlockedWriterScope TrackBlockedWriter() => new(this);

    /// <summary>Tracks one blocked writer. Created by <see cref="TrackBlockedWriter"/>.</summary>
    public readonly struct BlockedWriterScope : IDisposable
    {
        private readonly BufferObservability _owner;
        private readonly long _startedTimestamp;

        internal BlockedWriterScope(BufferObservability owner)
        {
            _owner = owner;
            _startedTimestamp = Stopwatch.GetTimestamp();
            Interlocked.Increment(ref owner._blockedWriters);
        }

        /// <summary>Clears the blocked-writer count and records the wait duration.</summary>
        public void Dispose()
        {
            if (_owner is null)
            {
                return;
            }

            Interlocked.Decrement(ref _owner._blockedWriters);
            _owner.WriteWait.Record(Stopwatch.GetElapsedTime(_startedTimestamp).TotalMilliseconds, _owner._tags);
        }
    }
}
