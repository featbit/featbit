using System.Threading.Channels;
using Domain.Observability;
using Microsoft.Extensions.Options;

namespace Application.Insights;

/// <summary>
/// One buffered insight, together with the size of the payload it was parsed from.
/// </summary>
/// <remarks>
/// The size travels with the item because it is only knowable at the point of enqueue — the caller
/// there already holds the serialized message — and it has to be known again at dequeue to keep the
/// running byte total honest. Measuring it any other way would mean re-serializing on the ingest
/// path purely for telemetry.
/// </remarks>
public readonly record struct BufferedInsight(object Insight, int Bytes);

public sealed class InsightsTracker
{
    private readonly Channel<BufferedInsight> _channel;
    private readonly BufferObservability _observability;

    public InsightsTracker(IOptions<InsightsTrackingOptions> options)
    {
        var capacity = options.Value.ChannelCapacity;

        _channel = Channel.CreateBounded<BufferedInsight>(
            new BoundedChannelOptions(capacity)
            {
                FullMode = BoundedChannelFullMode.Wait,
                SingleReader = true,
                SingleWriter = false
            }
        );

        // This channel uses FullMode.Wait, so it never drops — it blocks the calling request thread
        // instead. Occupancy therefore just pins at capacity under load and tells you nothing; the
        // signal that matters is how many callers are blocked and for how long, because that is
        // what surfaces as request latency. Changing the full-mode is a capacity decision,
        // deliberately left alone.
        //
        // Bytes are tracked here and not on the other buffers because this is the only one whose
        // caller already holds a serialized form of the item, so the measurement is free.
        _observability = ServiceMeter.ForBuffer(
            BufferNames.Insights, capacity, () => _channel.Reader.Count, trackBytes: true);
    }

    /// <summary>
    /// Waits until at least one insight is available to read. Pair with <see cref="TryRead"/>.
    /// </summary>
    public ValueTask<bool> WaitToReadAsync(CancellationToken cancellationToken = default)
        => _channel.Reader.WaitToReadAsync(cancellationToken);

    /// <summary>
    /// Bytes currently buffered, as reported by <c>buffer.bytes</c>.
    /// </summary>
    public long BufferedBytes => _observability.BufferedBytes;

    /// <summary>
    /// Reads one buffered insight and settles its byte accounting.
    /// </summary>
    /// <remarks>
    /// Reading goes through the tracker rather than through an exposed <c>ChannelReader</c> so the
    /// byte total cannot be left un-decremented by a caller that reads directly.
    /// </remarks>
    public bool TryRead(out object insight)
    {
        if (_channel.Reader.TryRead(out var buffered))
        {
            _observability.RemoveBytes(buffered.Bytes);
            insight = buffered.Insight;
            return true;
        }

        insight = null!;
        return false;
    }

    /// <summary>
    /// Buffers <paramref name="insight"/>, blocking the caller if the channel is full.
    /// </summary>
    /// <param name="insight">The parsed insight.</param>
    /// <param name="byteSize">
    /// Size of the payload this insight was parsed from. Pass it whenever the caller already holds
    /// the serialized form; omitting it only means this item contributes nothing to
    /// <c>buffer.bytes</c>.
    /// </param>
    /// <param name="cancellationToken">Cancellation token.</param>
    public ValueTask RecordAsync(object insight, int byteSize = 0, CancellationToken cancellationToken = default)
    {
        var buffered = new BufferedInsight(insight, byteSize);

        // Fast path: no allocation and no timing when there is room, which is the common case.
        if (_channel.Writer.TryWrite(buffered))
        {
            _observability.AddBytes(byteSize);
            return ValueTask.CompletedTask;
        }

        return RecordBlockingAsync(buffered, cancellationToken);
    }

    private async ValueTask RecordBlockingAsync(BufferedInsight buffered, CancellationToken cancellationToken)
    {
        using (_observability.TrackBlockedWriter())
        {
            await _channel.Writer.WriteAsync(buffered, cancellationToken);
        }

        _observability.AddBytes(buffered.Bytes);
    }

    public void Complete() => _channel.Writer.TryComplete();
}
