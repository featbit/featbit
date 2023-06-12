namespace Domain.Messages;

public class Topics
{
    public const string EndUser = "featbit-endusers";

    // This pattern **must** cover FeatureFlagChange & SegmentChange
    public const string DataChangePattern = "featbit-*-change";
    public const string FeatureFlagChange = "featbit-feature-flag-change";
    public const string SegmentChange = "featbit-segment-change";

    public const string Insights = "featbit-insights";
}