using System.Diagnostics;
using Domain.Observability;

namespace Domain.Evaluation;

public class Evaluator(IRuleMatcher ruleMatcher) : IEvaluator
{
    /// <summary>
    /// The match reason the default (fallthrough) rule records. It is the one
    /// <see cref="UserVariation.MatchReason"/> value that is not user-authored, which is what lets
    /// <see cref="ReasonOf"/> tell a fallthrough apart from a real rule match without tagging a
    /// metric with a customer-defined rule name.
    /// </summary>
    internal const string DefaultRuleMatchReason = "default";

    /// <summary>
    /// Evaluates <paramref name="scope"/> and records the M9 evaluation metrics around it.
    /// </summary>
    /// <remarks>
    /// This is the hottest path in the service — one call per flag per connected client per change —
    /// so when nothing is listening it delegates straight to <see cref="EvaluateCoreAsync"/> without
    /// even reading a timestamp. The evaluation logic itself lives in <see cref="EvaluateCoreAsync"/>
    /// and is unchanged; this wrapper is pure instrumentation and never alters the result or the
    /// exception that propagates.
    /// </remarks>
    public async ValueTask<UserVariation> EvaluateAsync(EvaluationScope scope)
    {
        var metrics = EvaluationMetrics.Current;
        if (!metrics.Enabled)
        {
            return await EvaluateCoreAsync(scope);
        }

        var start = Stopwatch.GetTimestamp();
        try
        {
            var userVariation = await EvaluateCoreAsync(scope);
            metrics.RecordEvaluation(
                ReasonOf(userVariation), Outcomes.Success, Stopwatch.GetElapsedTime(start));

            return userVariation;
        }
        catch (MalformedDataException)
        {
            metrics.RecordEvaluation(
                EvaluationReasons.MalformedData, Outcomes.Failure, Stopwatch.GetElapsedTime(start));
            throw;
        }
        catch (Exception)
        {
            metrics.RecordEvaluation(
                EvaluationReasons.Error, Outcomes.Failure, Stopwatch.GetElapsedTime(start));
            throw;
        }
    }

    /// <summary>
    /// Maps a variation onto the bounded <c>reason</c> vocabulary using its <i>type</i>.
    /// <see cref="UserVariation.MatchReason"/> is deliberately not used as a tag value: for a
    /// rollout it is the user-authored rule name.
    /// </summary>
    private static string ReasonOf(UserVariation userVariation) => userVariation switch
    {
        NullUserVariation => EvaluationReasons.Archived,
        FeatureFlagDisabledUserVariation => EvaluationReasons.Disabled,
        TargetedUserVariation => EvaluationReasons.Targeted,
        RolloutUserVariation rollout => rollout.MatchReason == DefaultRuleMatchReason
            ? EvaluationReasons.Fallthrough
            : EvaluationReasons.RuleMatch,
        _ => EvaluationReasons.Error
    };

    private async ValueTask<UserVariation> EvaluateCoreAsync(EvaluationScope scope)
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
            DefaultRuleMatchReason
        );
    }
}
