namespace Application.FeatureFlags;

public class StatsByVariationFilter
{
    public string FeatureFlagKey { get; set; }
    public string IntervalType { get; set; }
    public long From { get; set; }
    public long To { get; set; }
}

public static class IntervalType
{
    public const string Month = "MONTH";
    public const string Week = "WEEK";
    public const string Day = "DAY";
    public const string Hour = "HOUR";
    public const string Minute = "MINUTE";

    public static bool IsDefined(string intervalType) => intervalType is Month or Week or Day or Hour or Minute;
}