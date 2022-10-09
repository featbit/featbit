namespace Domain.FeatureFlags;

public class RolloutVariation
{
    public string Id { get; set; }

    public double[] Rollout { get; set; }

    public double ExptRollout { get; set; }

    public bool IsEmpty()
    {
        return Rollout[1] - Rollout[0] == 0;
    }
}