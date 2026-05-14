using System.Threading.Channels;
using Microsoft.Extensions.Options;

namespace Application.Usages;

public class UsageTracker(IOptions<UsageTrackingOptions> options)
{
    private readonly Channel<UsageRecord> _recordsChannel = Channel.CreateBounded<UsageRecord>(
        new BoundedChannelOptions(options.Value.ChannelCapacity)
        {
            FullMode = BoundedChannelFullMode.DropOldest,
            SingleWriter = false,
            SingleReader = true
        }
    );

    public void RecordInsights(Guid envId, DateOnly recordedAt, string[] endUsers, int flagEvaluations, int customMetrics)
    {
        var record = new InsightsUsageRecord(envId, recordedAt, endUsers, flagEvaluations, customMetrics);
        _recordsChannel.Writer.TryWrite(record);
    }

    public ChannelReader<UsageRecord> Reader => _recordsChannel.Reader;
}