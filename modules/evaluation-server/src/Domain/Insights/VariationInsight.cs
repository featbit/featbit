using Domain.Core;

namespace Domain.Insights;

public class VariationInsight
{
    public string FeatureFlagKeyName { get; set; }

    public Variation Variation { get; set; }

    public long Timestamp { get; set; }
}