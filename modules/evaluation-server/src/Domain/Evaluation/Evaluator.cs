namespace Domain.Evaluation;

public class Evaluator : IEvaluator
{
    private readonly IRuleMatcher _ruleMatcher;

    public Evaluator(IRuleMatcher ruleMatcher)
    {
        _ruleMatcher = ruleMatcher;
    }

    public async ValueTask<UserVariation> EvaluateAsync(EvaluationScope scope)
    {
        var flag = scope.Flag;
        var user = scope.User;

        // if flag is disabled
        var isEnabled = flag.GetProperty("isEnabled").GetBoolean();
        if (!isEnabled)
        {
            var disabledVariationId = flag.GetProperty("disabledVariationId").GetString()!;
            return new FeatureFlagDisabledUserVariation(scope.GetVariation(disabledVariationId));
        }

        var exptIncludeAllTargets = flag.GetProperty("exptIncludeAllTargets").GetBoolean();

        // if user is targeted
        var targetUsers = flag.GetProperty("targetUsers").EnumerateArray();
        foreach (var targetUser in targetUsers)
        {
            var keyIds = targetUser.GetProperty("keyIds").EnumerateArray();
            foreach (var keyId in keyIds)
            {
                if (user.KeyId == keyId.GetString())
                {
                    var targetVariation = scope.GetVariation(targetUser.GetProperty("variationId").GetString()!);
                    return new TargetedUserVariation(targetVariation, exptIncludeAllTargets);
                }
            }
        }

        var flagKey = flag.GetProperty("key").GetString();
        string dispatchKey;

        // if user is rule matched
        var rules = flag.GetProperty("rules").EnumerateArray();
        foreach (var rule in rules)
        {
            if (await _ruleMatcher.IsMatchAsync(rule, user))
            {
                var ruleDispatchKey = rule.GetProperty("dispatchKey").GetString();
                dispatchKey = string.IsNullOrWhiteSpace(ruleDispatchKey)
                    ? $"{flagKey}{user.KeyId}"
                    : $"{flagKey}{user.ValueOf(ruleDispatchKey)}";

                return new RolloutUserVariation(
                    rule.GetProperty("variations"),
                    dispatchKey,
                    scope.Variations,
                    exptIncludeAllTargets,
                    rule.GetProperty("includedInExpt").GetBoolean(),
                    rule.GetProperty("name").GetString()!
                );
            }
        }

        // match default rule
        var fallthrough = flag.GetProperty("fallthrough");

        var fallthroughDispatchKey = fallthrough.GetProperty("dispatchKey").GetString();
        dispatchKey = string.IsNullOrWhiteSpace(fallthroughDispatchKey)
            ? $"{flagKey}{user.KeyId}"
            : $"{flagKey}{user.ValueOf(fallthroughDispatchKey)}";

        return new RolloutUserVariation(
            fallthrough.GetProperty("variations"),
            dispatchKey,
            scope.Variations,
            exptIncludeAllTargets,
            fallthrough.GetProperty("includedInExpt").GetBoolean(),
            "default"
        );
    }
}