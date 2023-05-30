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
        Flag = flag;
        User = user;
        Variations = variations;
    }

    public Variation GetVariation(string variationId)
    {
        return Variations.FirstOrDefault(x => x.Id == variationId)!;
    }
}