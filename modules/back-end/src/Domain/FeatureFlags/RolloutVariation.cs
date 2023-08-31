using Domain.Targeting;

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

    public bool IsInRollout(string key) => DispatchAlgorithm.IsInRollout(key, Rollout);

    public bool IsRolloutEquals(RolloutVariation other)
    {
        const double tolerance = 0.00001;

        return Math.Abs(Rollout[0] - other.Rollout[0]) < tolerance &&
               Math.Abs(Rollout[1] - other.Rollout[1]) < tolerance;
    }
}