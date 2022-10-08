namespace Domain.FeatureFlags;

public class Variation
{
    public int LocalId { get; set; }

    public string Value { get; set; }

    public double[] Rollout { get; set; }

    public double? ExptRollout { get; set; }
}