using System.Text.Json;
using System.Text.Json.Nodes;
using Domain.EndUsers;
using Domain.Evaluation;

namespace Domain.UnitTests.Evaluation;

public class EvaluatorTests
{
    [Theory]
    [InlineData("targeted")]
    [InlineData("rule")]
    [InlineData("default")]
    [InlineData("flag disabled")]
    [InlineData("flag archived")]
    public async Task Evaluate_LegacyFieldsDoNotAffectVariationOrMatchReason(string path)
    {
        var flag = JsonNode.Parse("""
            {"key":"flag","isEnabled":true,"isArchived":false,"disabledVariationId":"off",
             "targetUsers":[],"rules":[],
             "fallthrough":{"dispatchKey":null,"variations":[{"id":"on","rollout":[0,0.5]},{"id":"off","rollout":[0.5,1]}]}}
            """)!.AsObject();
        if (path == "targeted")
            flag["targetUsers"] = JsonNode.Parse("""[{"variationId":"on","keyIds":["user"]}]""");
        if (path == "rule")
        {
            var rule = flag["fallthrough"]!.DeepClone().AsObject();
            rule["name"] = "rule";
            flag["rules"]!.AsArray().Add(rule);
        }
        if (path == "flag disabled") flag["isEnabled"] = false;
        if (path == "flag archived") flag["isArchived"] = true;

        var evaluator = new Evaluator(new MatchingRuleMatcher());
        Variation[] variations = [new("on", "true"), new("off", "false")];
        var user = new EndUser { KeyId = "user" };
        var expected = await Evaluate(flag);
        Assert.Equal(path, expected.MatchReason);

        flag["exptIncludeAllTargets"] = true;
        foreach (var rule in flag["rules"]!.AsArray().Append(flag["fallthrough"]))
        {
            rule!["includedInExpt"] = true;
            foreach (var variation in rule["variations"]!.AsArray())
                variation!["exptRollout"] = 1.0;
        }

        var actual = await Evaluate(flag);
        Assert.Equal(expected.Variation?.Id, actual.Variation?.Id);
        Assert.Equal(expected.Variation?.Value, actual.Variation?.Value);
        Assert.Equal(expected.MatchReason, actual.MatchReason);

        async Task<UserVariation> Evaluate(JsonObject input)
        {
            using var json = JsonDocument.Parse(input.ToJsonString());
            return await evaluator.EvaluateAsync(new EvaluationScope(json.RootElement, user, variations));
        }
    }

    private sealed class MatchingRuleMatcher : IRuleMatcher
    {
        public ValueTask<bool> IsMatchAsync(JsonElement rule, EndUser user) => ValueTask.FromResult(true);
    }
}
