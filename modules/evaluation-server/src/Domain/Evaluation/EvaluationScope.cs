using System.Text.Json;
using Domain.EndUsers;

namespace Domain.Evaluation;

public struct EvaluationScope
{
    public JsonElement Flag { get; }

    public EndUser User { get; }

    public Variation[] Variations { get; set; }

    public EvaluationScope(JsonElement flag, EndUser user, Variation[] variations)
    {
        for (var i = 0; i < variations.Length; i++)
        {
            var variation = variations[i];

            if (variation is null || !variation.IsValid())
            {
                throw EntityJsonReader.FeatureFlag.Malformed(
                    "Variation must have a valid ID and a non-null value",
                    $"variations[{i}]"
                );
            }
        }

        Flag = flag;
        User = user;
        Variations = variations;
    }

    public Variation GetVariation(string variationId)
    {
        return Variations.FirstOrDefault(x => x.Id == variationId) ??
               throw EntityJsonReader.FeatureFlag.Malformed(
                   $"Variation '{variationId}' does not exist in the feature flag",
                   "variations"
               );
    }
}
