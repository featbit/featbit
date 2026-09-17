namespace Domain.Experiments;

/// <summary>A metric's identity and calculation settings captured for an experiment or run.</summary>
public abstract record MetricConfig
{
    public required Guid MetricId { get; init; }

    public string MetricKey { get; init; }

    public string Name { get; init; }

    public string EventName { get; init; }

    public string Description { get; init; }

    public string MetricType { get; init; } = "binary";

    public string MetricAgg { get; init; } = "once";
}

public sealed record PrimaryMetricConfig : MetricConfig
{
    public string ExpectedDirection { get; init; } = "increase_good";
}

public sealed record GuardrailMetricConfig : MetricConfig
{
    public string Direction { get; init; } = "increase_bad";
}
