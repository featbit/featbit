using System.Threading.Channels;
using Domain.Observability;
using Microsoft.Extensions.Options;

namespace Application.Usages;

public class UsageTracker
{
    private readonly Channel<UsageRecord> _recordsChannel;
    private readonly BufferObservability _observability;
    private readonly int _capacity;

    public UsageTracker(IOptions<UsageTrackingOptions> options)
    {
        var capacity = options.Value.ChannelCapacity;
        _capacity = capacity;

        _recordsChannel = Channel.CreateBounded<UsageRecord>(
            new BoundedChannelOptions(capacity)
            {
                FullMode = BoundedChannelFullMode.DropOldest,
                SingleWriter = false,
                SingleReader = true
            }
        );

        // M5: DropOldest sheds load silently — occupancy looks healthy at exactly the moment data
        // is being lost, so the drop counter is the primary signal here, not the gauge.
        _observability = ServiceMeter.ForBuffer(
            BufferNames.Usage, capacity, () => _recordsChannel.Reader.Count);
    }

    public void RecordInsights(Guid envId, DateOnly recordedAt, string[] endUsers, int flagEvaluations, int customMetrics)
    {
        var record = new InsightsUsageRecord(envId, recordedAt, endUsers, flagEvaluations, customMetrics);

        // DropOldest means TryWrite always succeeds and silently evicts the oldest item, so a
        // failed write can never be the drop signal. A full channel at write time is.
        if (_recordsChannel.Reader.Count >= _capacity)
        {
            _observability.RecordDropped();
        }

        _recordsChannel.Writer.TryWrite(record);
    }

    public ChannelReader<UsageRecord> Reader => _recordsChannel.Reader;
}