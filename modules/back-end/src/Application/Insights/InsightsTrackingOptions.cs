using System.ComponentModel.DataAnnotations;

namespace Application.Insights;

public sealed class InsightsTrackingOptions
{
    public const string InsightsTracking = nameof(InsightsTracking);

    [Range(1, 30_000)]
    public int FlushIntervalMs { get; set; } = 1_000;

    [Range(1, 100_000)]
    public int ChannelCapacity { get; set; } = 10_000;

    [Range(1, 10_000)]
    public int MaxBatchSize { get; set; } = 1_000;
}
