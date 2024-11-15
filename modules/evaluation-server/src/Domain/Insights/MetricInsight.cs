#nullable disable

using System.ComponentModel.DataAnnotations;

namespace Domain.Insights;

public class MetricInsight
{
    public string Route { get; set; }

    public string Type { get; set; }

    [Required]
    [RegularExpression("^([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})(?:-(\\w[\\w-]*))?$|^(\\w[\\w-]*)$")]
    public string EventName { get; set; }

    public float NumericValue { get; set; }

    public string AppType { get; set; }

    public long Timestamp { get; set; }
}