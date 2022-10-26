#nullable disable

using Domain.Core;

namespace Domain.Insights;

public class VariationInsight
{
    public string FeatureFlagKey { get; set; }

    public Variation Variation { get; set; }

    public bool SendToExperiment { get; set; }

    public long Timestamp { get; set; }
}