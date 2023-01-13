using System.Text.Json;

namespace Domain.Core;

public abstract class UserVariation
{
    public abstract bool SendToExperiment { get; }

    public Variation Variation { get; set; }

    public string MatchReason { get; set; }

    protected UserVariation(Variation variation, string matchReason)
    {
        Variation = variation;
        MatchReason = matchReason;
    }
}

public sealed class FeatureFlagDisabledUserVariation : UserVariation
{
    public override bool SendToExperiment => false;

    public FeatureFlagDisabledUserVariation(Variation variation)
        : base(variation, "flag disabled")
    {
    }
}

public sealed class TargetedUserVariation : UserVariation
{
    public override bool SendToExperiment { get; }

    public TargetedUserVariation(Variation variation, bool exptIncludeAllTargets)
        : base(variation, "targeted")
    {
        SendToExperiment = exptIncludeAllTargets;
    }
}

public sealed class RolloutUserVariation : UserVariation
{
    public override bool SendToExperiment { get; }

    public RolloutUserVariation(
        JsonElement rolloutVariations,
        string splittingKey,
        Variation[] allVariations,
        bool exptIncludeAllTargets,
        bool thisRuleIncludeInExpt,
        string matchReason)
        : base(Variation.Empty, matchReason)
    {
        var splittingRollout = 0.0;
        var exptRollout = 0.0;

        foreach (var rolloutVariation in rolloutVariations.EnumerateArray())
        {
            var rollouts = rolloutVariation.GetProperty("rollout").Deserialize<double[]>()!;
            if (SplittingAlgorithm.IsInRollout(splittingKey, rollouts))
            {
                var variationId = rolloutVariation.GetProperty("id").GetString()!;
                Variation = allVariations.FirstOrDefault(x => x.Id == variationId)!;
                splittingRollout = rollouts[1] - rollouts[0];
                exptRollout = rolloutVariation.GetProperty("exptRollout").GetDouble();
                break;
            }
        }

        if (exptIncludeAllTargets)
        {
            SendToExperiment = true;
        }
        else if (!thisRuleIncludeInExpt)
        {
            SendToExperiment = false;
        }
        else
        {
            // create a new key to calculate the experiment splitting percentage
            var sendToExptKey = splittingKey + splittingKey;
            if (exptRollout == 0.0 || splittingRollout == 0.0)
            {
                SendToExperiment = false;
                return;
            }

            var upperBound = exptRollout / splittingRollout;
            if (upperBound > 1.0)
            {
                upperBound = 1.0;
            }

            SendToExperiment = SplittingAlgorithm.IsInRollout(sendToExptKey, new[] { 0.0, upperBound });
        }
    }
}