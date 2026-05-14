using Domain.Targeting;

namespace Domain.FeatureFlags;

public class RolloutVariation
{
    /// <summary>
    /// The ID of the served variation.
    /// </summary>
    public string Id { get; set; }

    /// <summary>
    /// The rollout range for the variation.
    /// </summary>
    public double[] Rollout { get; set; }

    /// <summary>
    /// The rollout percentage for experiments.
    /// </summary>
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