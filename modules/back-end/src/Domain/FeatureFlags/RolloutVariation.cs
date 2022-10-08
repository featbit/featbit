namespace Domain.FeatureFlags;

public class RolloutVariation : Variation
{
    public double[] Rollout { get; set; }

    public double? ExptRollout { get; set; }
}