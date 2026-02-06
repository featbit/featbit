using System.Text.Json;
using Api.Contracts;
using Api.Services;
using Domain.Evaluation;
using Domain.Shared;
using Microsoft.AspNetCore.Mvc;

namespace Api.Public;

public class FeatureFlagController(IFeatureFlagService flagService, IEvaluator evaluator) : PublicApiControllerBase
{
    [HttpPost("evaluate")]
    public async Task<IActionResult> EvaluateAsync(EvaluateFlagRequest request)
    {
        if (!Authenticated)
        {
            return Unauthorized();
        }

        if (!request.TryValidate(out var validationError))
        {
            return BadRequest(validationError);
        }

        var filter = request.Filter ?? new FeatureFlagFilter();
        var flags = await flagService.GetListAsync(EnvId, filter);

        var evalResults = new List<EvalResult>();
        foreach (var flag in flags)
        {
            var variations =
                flag.GetProperty("variations").Deserialize<Variation[]>(ReusableJsonSerializerOptions.Web)!;

            var scope = new EvaluationScope(flag, request.User!, variations);
            var userVariation = await evaluator.EvaluateAsync(scope);
            var evalResult = new EvalResult(flag, userVariation);

            evalResults.Add(evalResult);
        }

        return Ok(evalResults);
    }
}