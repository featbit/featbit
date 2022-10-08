namespace Domain.FeatureFlags;

public class RolloutVariation
{
    public string Id { get; set; }

    public double[] Rollout { get; set; }

    public double ExptRollout { get; set; }
}