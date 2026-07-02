#nullable disable

using System.Text.RegularExpressions;

namespace Domain.Insights;

public partial class MetricInsight
{
    [GeneratedRegex("^([a-zA-Z0-9_-]+)$")]
    private static partial Regex EventNameRegex();

    public string Route { get; set; }

    public string Type { get; set; }

    public string EventName { get; set; }

    public float NumericValue { get; set; }

    public string AppType { get; set; }

    public long Timestamp { get; set; }

    public bool IsValid()
    {
        // event name must be non-empty, less than 40 characters, and contain only alphanumeric characters, underscores, or hyphens
        if (string.IsNullOrWhiteSpace(EventName) || EventName.Length > 40 || !EventNameRegex().IsMatch(EventName))
        {
            return false;
        }

        return true;
    }
}