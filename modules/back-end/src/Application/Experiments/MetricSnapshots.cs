using Domain.Experiments;

namespace Application.Experiments;

public static class MetricSnapshots
{
    public static string Identity(MetricConfig metric) =>
        metric.MetricId.ToString("D");

    public static PrimaryMetricConfig Copy(PrimaryMetricConfig metric) =>
        metric is null ? null : metric with { };

    public static List<GuardrailMetricConfig> Copy(IEnumerable<GuardrailMetricConfig> metrics) =>
        metrics.Select(metric => metric with { }).ToList();
}
