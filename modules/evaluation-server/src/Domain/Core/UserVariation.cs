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
        string userKeyId,
        Variation[] allVariations,
        bool exptIncludeAllTargets,
        bool thisRuleIncludeInExpt,
        string matchReason)
        : base(Variation.Empty, matchReason)
    {
        var sendToExptRollout = new[] { 0.0, 0.0 };
        foreach (var rolloutVariation in rolloutVariations.EnumerateArray())
        {
            var rollouts = rolloutVariation.GetProperty("rollout").Deserialize<double[]>()!;
            if (SplittingAlgorithm.IsInRollout(userKeyId, rollouts))
            {
                var variationId = rolloutVariation.GetProperty("id").GetString()!;
                Variation = allVariations.FirstOrDefault(x => x.Id == variationId)!;

                // send to experiment rollout
                sendToExptRollout[0] = rollouts[0];
                sendToExptRollout[1] = rollouts[1] * rolloutVariation.GetProperty("exptRollout").GetDouble();
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
            SendToExperiment = SplittingAlgorithm.IsInRollout(userKeyId, sendToExptRollout);
        }
    }
}