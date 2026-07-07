#nullable disable

using System.Text.RegularExpressions;

namespace Domain.Insights;

public partial class MetricInsight
{
    private const int MaxEventNameLength = 128;
    private const int MaxRouteLength = 256;
    private const int MaxTypeLength = 64;
    private const int MaxAppTypeLength = 128;

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
        if (Route is not null && Route.Length > MaxRouteLength)
        {
            return false;
        }

        if (Type is not null && Type.Length > MaxTypeLength)
        {
            return false;
        }

        // event name must be non-empty, less than 128 characters, and contain only alphanumeric characters, underscores, or hyphens
        if (string.IsNullOrWhiteSpace(EventName) ||
            EventName.Length > MaxEventNameLength ||
            !EventNameRegex().IsMatch(EventName))
        {
            return false;
        }

        if (AppType is not null && AppType.Length > MaxAppTypeLength)
        {
            return false;
        }

        return true;
    }
}