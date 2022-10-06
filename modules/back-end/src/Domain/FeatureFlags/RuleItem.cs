using Domain.Segments;

namespace Domain.FeatureFlags;

public class RuleItem
{
    public string Property { get; set; }

    public string Op { get; set; }

    public string Value { get; set; }

    public bool IsSegmentRule()
    {
        var isSegmentProperty = SegmentConsts.RuleProperties.Contains(Property);

        return isSegmentProperty;
    }
}