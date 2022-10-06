namespace Domain.FeatureFlags;

public class Variation
{
    public double? ExptRollout { get; set; }

    public double[] RolloutPercentage { get; set; }

    public VariationValue Value { get; set; }
}