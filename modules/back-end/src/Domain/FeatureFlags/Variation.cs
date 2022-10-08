namespace Domain.FeatureFlags;

public class Variation
{
    public string LocalId { get; set; }

    public string Value { get; set; }

    public double[] Rollout { get; set; }

    public double? ExptRollout { get; set; }
}