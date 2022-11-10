namespace Application.FeatureFlags;

public class StatsByVariationFilter
{
    public string FeatureFlagKey { get; set; }
    public string IntervalType { get; set; }
    public long From { get; set; }
    public long To { get; set; }
}

public static class IntervalTypeEnum
{
    public static string Month => "MONTH";
    public static string Week => "WEEK";
    public static string Day => "DAY";
    public static string Hour => "HOUR";
    public static string Minute => "MINUTE";
}