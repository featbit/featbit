using System.Text.Json;

namespace Domain.Evaluation;

public abstract class UserVariation
{
    public Variation? Variation { get; set; }

    public string MatchReason { get; set; }

    protected UserVariation(Variation? variation, string matchReason)
    {
        Variation = variation;
        MatchReason = matchReason;
    }
}

public sealed class NullUserVariation : UserVariation
{
    public static readonly NullUserVariation Instance = new();

    private NullUserVariation()
        : base(null, "flag archived")
    {
    }
}

public sealed class FeatureFlagDisabledUserVariation : UserVariation
{
    public FeatureFlagDisabledUserVariation(Variation variation)
        : base(variation, "flag disabled")
    {
    }
}

public sealed class TargetedUserVariation : UserVariation
{
    public TargetedUserVariation(Variation variation)
        : base(variation, "targeted")
    {
    }
}

public sealed class RolloutUserVariation : UserVariation
{
    public RolloutUserVariation(
        JsonElement rolloutVariations,
        string dispatchKey,
        Variation[] allVariations,
        string matchReason)
        : base(Variation.Empty, matchReason)
    {
        var reader = EntityJsonReader.FeatureFlag;
        foreach (var rolloutVariation in rolloutVariations.EnumerateArray())
        {
            var rollouts = reader.DeserializeRequiredArray<double>(rolloutVariation, "rollout");
            if (rollouts.Length != 2)
            {
                throw reader.Malformed(
                    "Property 'rollout' must contain exactly two numbers",
                    "rollout"
                );
            }

            if (DispatchAlgorithm.IsInRollout(dispatchKey, rollouts))
            {
                var variationId = reader.GetRequiredString(rolloutVariation, "id");
                Variation = allVariations.FirstOrDefault(x => x.Id == variationId) ??
                            throw reader.Malformed(
                                $"Rollout references variation '{variationId}' which does not exist in the feature flag",
                                "id"
                            );
                break;
            }
        }
    }
}
