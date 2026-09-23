using System.Diagnostics.Metrics;

namespace Streaming.Insights;

public sealed class InsightsMetrics
{
    public const string MeterName = "FeatBit.EvaluationServer";

    public const string DroppedCounterName = "featbit.insights.dropped";

    private readonly Counter<long> _dropped;

    public InsightsMetrics(IMeterFactory meterFactory)
    {
        var meter = meterFactory.Create(MeterName);
        _dropped = meter.CreateCounter<long>(
            DroppedCounterName,
            unit: "{evaluation}",
            description: "Flag evaluations dropped because insights are disabled for the flag."
        );
    }

    // tagged by environment and flag only: no end-user or evaluation details
    public void RecordDropped(Guid envId, string flagKey) =>
        _dropped.Add(1, new("env_id", envId.ToString()), new("flag_key", flagKey));
}
