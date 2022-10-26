#nullable disable

namespace Domain.Insights;

public class MetricInsight
{
    public string Route { get; set; }

    public string Type { get; set; }

    public string EventName { get; set; }

    public float NumericValue { get; set; }

    public string AppType { get; set; }
}