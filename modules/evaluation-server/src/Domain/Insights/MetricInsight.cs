#nullable disable

using System.Text.RegularExpressions;

namespace Domain.Insights;

public partial class MetricInsight
{
    [GeneratedRegex("^([a-zA-Z0-9-]+)$")]
    private static partial Regex AlphaNumericRegex();

    public string Route { get; set; }

    public string Type { get; set; }

    public string EventName { get; set; }

    public float NumericValue { get; set; }

    public string AppType { get; set; }

    public long Timestamp { get; set; }

    public bool IsValid()
    {
        if (string.IsNullOrWhiteSpace(EventName) || !AlphaNumericRegex().IsMatch(EventName))
        {
            return false;
        }

        return true;
    }
}