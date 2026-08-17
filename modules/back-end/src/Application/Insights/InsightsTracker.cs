using System.Threading.Channels;
using Microsoft.Extensions.Options;

namespace Application.Insights;

public sealed class InsightsTracker(IOptions<InsightsTrackingOptions> options)
{
    private readonly Channel<object> _channel = Channel.CreateBounded<object>(
        new BoundedChannelOptions(options.Value.ChannelCapacity)
        {
            FullMode = BoundedChannelFullMode.Wait,
            SingleReader = true,
            SingleWriter = false
        }
    );

    public ChannelReader<object> Reader => _channel.Reader;

    public ValueTask RecordAsync(object insight, CancellationToken cancellationToken = default)
        => _channel.Writer.WriteAsync(insight, cancellationToken);

    public void Complete() => _channel.Writer.TryComplete();
}
