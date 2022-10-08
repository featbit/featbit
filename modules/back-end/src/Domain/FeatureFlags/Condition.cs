using Domain.Segments;

namespace Domain.FeatureFlags;

public class Condition
{
    public string Property { get; set; }

    public string Op { get; set; }

    public string Value { get; set; }

    public bool IsSegmentCondition()
    {
        var isSegmentProperty = SegmentConsts.RuleProperties.Contains(Property);

        return isSegmentProperty;
    }
}