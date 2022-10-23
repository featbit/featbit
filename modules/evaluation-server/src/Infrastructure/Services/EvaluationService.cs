using Domain.Core;

namespace Infrastructure.Services;

public class EvaluationService
{
    public async Task<UserVariation> EvaluateAsync(EvaluationContext context)
    {
        var variation = new Variation
        {
            Id = Guid.NewGuid().ToString(),
            Value = "true"
        };

        return new DefaultUserVariation(variation);
    }
}