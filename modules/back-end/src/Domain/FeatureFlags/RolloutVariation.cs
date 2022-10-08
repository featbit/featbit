namespace Domain.FeatureFlags;

public class RolloutVariation
{
    public string Id { get; set; }

    public string Value { get; set; }

    public double[] Rollout { get; set; }

    public double? ExptRollout { get; set; }
}