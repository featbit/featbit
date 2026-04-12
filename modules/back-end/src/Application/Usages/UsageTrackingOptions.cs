using System.ComponentModel.DataAnnotations;

namespace Application.Usages;

public class UsageTrackingOptions
{
    public const string UsageTracking = nameof(UsageTracking);

    [Range(1000, 30_000, ErrorMessage = "Flush interval must be between 1,000 ms and 30,000 ms.")]
    public int FlushIntervalMs { get; set; } = 5000;

    [Range(1000, 100_000, ErrorMessage = "Channel capacity must be between 1,000 and 100,000.")]
    public int ChannelCapacity { get; set; } = 10_000;
}