namespace Domain.Evaluation;

public class Evaluator(IRuleMatcher ruleMatcher) : IEvaluator
{
    public async ValueTask<UserVariation> EvaluateAsync(EvaluationScope scope)
    {
        var flag = scope.Flag;
        var user = scope.User;
        var reader = EntityJsonReader.FeatureFlag;

        // if flag is archived
        var isArchived = reader.GetRequiredBoolean(flag, "isArchived");
        if (isArchived)
        {
            return NullUserVariation.Instance;
        }

        // if flag is disabled
        var isEnabled = reader.GetRequiredBoolean(flag, "isEnabled");
        if (!isEnabled)
        {
            var disabledVariationId = reader.GetRequiredString(flag, "disabledVariationId");
            return new FeatureFlagDisabledUserVariation(scope.GetVariation(disabledVariationId));
        }

        var exptIncludeAllTargets = reader.GetRequiredBoolean(flag, "exptIncludeAllTargets");

        // if user is targeted
        var targetUsers = reader.GetRequiredArray(flag, "targetUsers").EnumerateArray();
        foreach (var targetUser in targetUsers)
        {
            var keyIds = reader.GetRequiredArray(targetUser, "keyIds").EnumerateArray();
            foreach (var keyIdElement in keyIds)
            {
                var keyId = reader.GetRequiredStringValue(
                    keyIdElement,
                    "targetUsers.keyIds"
                );

                if (user.KeyId == keyId)
                {
                    var targetVariation = scope.GetVariation(
                        reader.GetRequiredString(targetUser, "variationId")
                    );
                    return new TargetedUserVariation(targetVariation, exptIncludeAllTargets);
                }
            }
        }

        var flagKey = reader.GetRequiredString(flag, "key");
        string dispatchKey;

        // if user is rule matched
        var rules = reader.GetRequiredArray(flag, "rules").EnumerateArray();
        foreach (var rule in rules)
        {
            if (await ruleMatcher.IsMatchAsync(rule, user))
            {
                var ruleDispatchKey = reader.GetNullableString(rule, "dispatchKey");
                dispatchKey = string.IsNullOrWhiteSpace(ruleDispatchKey)
                    ? $"{flagKey}{user.KeyId}"
                    : $"{flagKey}{user.ValueOf(ruleDispatchKey)}";

                return new RolloutUserVariation(
                    reader.GetRequiredArray(rule, "variations"),
                    dispatchKey,
                    scope.Variations,
                    exptIncludeAllTargets,
                    reader.GetRequiredBoolean(rule, "includedInExpt"),
                    reader.GetRequiredString(rule, "name")
                );
            }
        }

        // match default rule
        var fallthrough = reader.GetRequiredObject(flag, "fallthrough");

        var fallthroughDispatchKey = reader.GetNullableString(fallthrough, "dispatchKey");
        dispatchKey = string.IsNullOrWhiteSpace(fallthroughDispatchKey)
            ? $"{flagKey}{user.KeyId}"
            : $"{flagKey}{user.ValueOf(fallthroughDispatchKey)}";

        return new RolloutUserVariation(
            reader.GetRequiredArray(fallthrough, "variations"),
            dispatchKey,
            scope.Variations,
            exptIncludeAllTargets,
            reader.GetRequiredBoolean(fallthrough, "includedInExpt"),
            "default"
        );
    }
}
