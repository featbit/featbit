using System.Text.Json;

namespace Domain.Evaluation;

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
        string dispatchKey,
        Variation[] allVariations,
        bool exptIncludeAllTargets,
        bool thisRuleIncludeInExpt,
        string matchReason)
        : base(Variation.Empty, matchReason)
    {
        var dispatchRollout = 0.0;
        var exptRollout = 0.0;

        foreach (var rolloutVariation in rolloutVariations.EnumerateArray())
        {
            var rollouts = rolloutVariation.GetProperty("rollout").Deserialize<double[]>()!;
            if (DispatchAlgorithm.IsInRollout(dispatchKey, rollouts))
            {
                var variationId = rolloutVariation.GetProperty("id").GetString()!;
                Variation = allVariations.FirstOrDefault(x => x.Id == variationId)!;
                dispatchRollout = rollouts[1] - rollouts[0];
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
            // create a new key to calculate the experiment dispatch percentage
            const string exptDispatchKeyPrefix = "expt";
            var sendToExptKey = $"{exptDispatchKeyPrefix}{dispatchKey}";
            if (exptRollout == 0.0 || dispatchRollout == 0.0)
            {
                SendToExperiment = false;
                return;
            }

            var upperBound = exptRollout / dispatchRollout;
            if (upperBound > 1.0)
            {
                upperBound = 1.0;
            }

            SendToExperiment = DispatchAlgorithm.IsInRollout(sendToExptKey, new[] { 0.0, upperBound });
        }
    }
}