using Domain.Core;

namespace Infrastructure.Services;

public class EvaluationService
{
    private readonly TargetRuleMatcher _ruleMatcher;

    public EvaluationService(TargetRuleMatcher ruleMatcher)
    {
        _ruleMatcher = ruleMatcher;
    }

    public async Task<UserVariation> EvaluateAsync(EvaluationScope scope)
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
        
        // if user is rule matched
        var rules = flag.GetProperty("rules").EnumerateArray();
        foreach (var rule in rules)
        {
            if (await _ruleMatcher.IsMatchAsync(rule, user))
            {
                var userPropertyValue = user.ValueOf(rule.GetProperty("splittingKey").GetString());
                userPropertyValue = string.IsNullOrWhiteSpace(userPropertyValue) ? "keyId" : userPropertyValue;
                var ruleSplittingKey = $"{userPropertyValue}{flag.GetProperty("key")}";
                return new RolloutUserVariation(
                    rule.GetProperty("variations"),
                    ruleSplittingKey,
                    scope.Variations,
                    exptIncludeAllTargets,
                    rule.GetProperty("includedInExpt").GetBoolean(),
                    rule.GetProperty("name").GetString()!
                );
            }
        }

        // match default rule
        var fallthrough = flag.GetProperty("fallthrough");
        var propertyValue = user.ValueOf(fallthrough.GetProperty("splittingKey").GetString());
        propertyValue = string.IsNullOrWhiteSpace(propertyValue) ? "keyId" : propertyValue;
        var fallthroughSplittingKey = $"{propertyValue}{flag.GetProperty("key")}";
        return new RolloutUserVariation(
            fallthrough.GetProperty("variations"),
            fallthroughSplittingKey,
            scope.Variations,
            exptIncludeAllTargets,
            fallthrough.GetProperty("includedInExpt").GetBoolean(),
            "default"
        );
    }
}