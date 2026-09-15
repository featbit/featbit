using System.Text.Json;
using Domain.EndUsers;
using Domain.Evaluation;
using Domain.Observability;

namespace Domain.UnitTests.Observability;

/// <summary>
/// M9 — the evaluation instruments, and the cardinality trap they exist around.
/// </summary>
/// <remarks>
/// <para>
/// <b>Why these tests are written against the real <see cref="Evaluator"/> rather than against
/// <see cref="EvaluationMetrics"/> directly.</b> The instrument is trivial; the mapping into it is
/// not. <see cref="UserVariation.MatchReason"/> is, for a rollout, <i>the rule name the customer
/// typed into the UI</i>. Tagging a metric with it would produce one time series per targeting rule
/// in every environment on the installation, and would copy customer-authored text into telemetry
/// that leaves the process.
/// </para>
/// <para>
/// A test on the metric alone would pass just as happily if someone replaced the type switch with
/// <c>userVariation.MatchReason</c>. These tests drive real flag JSON through the real evaluator and
/// assert the recorded tag, so that substitution fails here.
/// </para>
/// </remarks>
[Collection(ObservabilityCollection.Name)]
public sealed class EvaluationMetricsTests
{
    private const string VariationId = "550e8400-e29b-41d4-a716-446655440000";

    private static Evaluator CreateSut(bool ruleMatches = false)
        => new(new StubRuleMatcher(ruleMatches));

    [Fact]
    public async Task Evaluate_ForAnArchivedFlag_RecordsTheArchivedReason()
    {
        var (reason, outcome) = await EvaluateAndReadTagsAsync(Flag(isArchived: true));

        Assert.Equal(EvaluationReasons.Archived, reason);
        Assert.Equal(Outcomes.Success, outcome);
    }

    [Fact]
    public async Task Evaluate_ForADisabledFlag_RecordsTheDisabledReason()
    {
        var (reason, outcome) = await EvaluateAndReadTagsAsync(Flag(isEnabled: false));

        Assert.Equal(EvaluationReasons.Disabled, reason);
        Assert.Equal(Outcomes.Success, outcome);
    }

    [Fact]
    public async Task Evaluate_ForATargetedUser_RecordsTheTargetedReason()
    {
        var (reason, _) = await EvaluateAndReadTagsAsync(Flag(targetKeyId: "u-1"), userKeyId: "u-1");

        Assert.Equal(EvaluationReasons.Targeted, reason);
    }

    /// <summary>
    /// The trap, pinned. The rule is named with a string that would be catastrophic as an attribute
    /// value, and the assertion is that it does not appear anywhere in the recorded tags.
    /// </summary>
    [Fact]
    public async Task RuleMatch_RecordsRuleMatch_AndNeverTheCustomerAuthoredRuleName()
    {
        const string customerAuthoredRuleName = "EU users on the 2024-Q3 pricing experiment";

        var metrics = EvaluationMetrics.Current;
        using var collector = new MetricCollector(metrics.Meter);

        var scope = Scope(Flag(ruleName: customerAuthoredRuleName), "u-2");
        await CreateSut(ruleMatches: true).EvaluateAsync(scope);

        var measurement = Assert.Single(collector.For("evaluation.evaluations"));

        Assert.Equal(EvaluationReasons.RuleMatch, measurement.Tag(ObservabilityTags.Reason));
        Assert.DoesNotContain(
            customerAuthoredRuleName,
            measurement.Tags.Values.Select(v => v?.ToString() ?? string.Empty));
    }

    /// <summary>
    /// A fallthrough is also a <c>RolloutUserVariation</c>, so it is only distinguishable from a
    /// real rule match by the one <c>MatchReason</c> value the product controls. If that sentinel
    /// is ever changed without updating the evaluator, every fallthrough silently starts reporting
    /// as a rule match — which would make "are any users actually matching a rule?" unanswerable.
    /// </summary>
    [Fact]
    public async Task Fallthrough_RecordsFallthrough_NotRuleMatch()
    {
        var (reason, _) = await EvaluateAndReadTagsAsync(Flag(), userKeyId: "u-3");

        Assert.Equal(EvaluationReasons.Fallthrough, reason);
    }

    [Fact]
    public async Task Evaluate_ForAMalformedFlag_RecordsFailureAndRethrows()
    {
        var metrics = EvaluationMetrics.Current;
        using var collector = new MetricCollector(metrics.Meter);

        using var document = JsonDocument.Parse("""{"isArchived": "not-a-boolean"}""");
        var scope = new EvaluationScope(
            document.RootElement, new EndUser { KeyId = "u-4" }, [new Variation(VariationId, "on")]);

        await Assert.ThrowsAsync<MalformedDataException>(
            async () => await CreateSut().EvaluateAsync(scope));

        var measurement = Assert.Single(collector.For("evaluation.evaluations"));

        Assert.Equal(EvaluationReasons.MalformedData, measurement.Tag(ObservabilityTags.Reason));
        Assert.Equal(Outcomes.Failure, measurement.Tag(ObservabilityTags.Outcome));
    }

    /// <summary>
    /// Duration is recorded alongside the outcome rather than on a success-only path, because the
    /// question "did evaluation get slow before it started failing?" needs both.
    /// </summary>
    [Fact]
    public async Task Evaluate_ForAnyFlag_RecordsTheDurationInMilliseconds()
    {
        var metrics = EvaluationMetrics.Current;
        using var collector = new MetricCollector(metrics.Meter);

        await CreateSut().EvaluateAsync(Scope(Flag(), "u-5"));

        var duration = Assert.Single(collector.For("evaluation.duration"));

        Assert.Equal("ms", duration.Unit);
        Assert.True(duration.Value >= 0);
    }

    [Fact]
    public void RecordMalformedEntity_ForAMalformedEntity_TagsTheResourceTypeOnly()
    {
        var metrics = EvaluationMetrics.Current;
        using var collector = new MetricCollector(metrics.Meter);

        metrics.RecordMalformedEntity(ChangeId.SegmentResource);

        var measurement = Assert.Single(collector.For("evaluation.malformed_entities"));

        Assert.Equal(ChangeId.SegmentResource, measurement.Tag(ObservabilityTags.ResourceType));
        Assert.Equal("{entity}", measurement.Unit);
    }

    private static async Task<(string? Reason, string? Outcome)> EvaluateAndReadTagsAsync(
        string flagJson, string userKeyId = "u-0")
    {
        var metrics = EvaluationMetrics.Current;
        using var collector = new MetricCollector(metrics.Meter);

        await CreateSut().EvaluateAsync(Scope(flagJson, userKeyId));

        var measurement = Assert.Single(collector.For("evaluation.evaluations"));

        return (measurement.Tag(ObservabilityTags.Reason), measurement.Tag(ObservabilityTags.Outcome));
    }

    private static EvaluationScope Scope(string flagJson, string userKeyId)
    {
        // The document must outlive the scope, so it is deliberately not disposed: JsonElement is a
        // view over the document's buffer, and disposing it here would invalidate the flag mid-test.
        var document = JsonDocument.Parse(flagJson);

        return new EvaluationScope(
            document.RootElement,
            new EndUser { KeyId = userKeyId },
            [new Variation(VariationId, "on")]);
    }

    private static string Flag(
        bool isArchived = false,
        bool isEnabled = true,
        string? targetKeyId = null,
        string? ruleName = null)
    {
        var targetUsers = targetKeyId is null
            ? "[]"
            : $$"""[{"keyIds": ["{{targetKeyId}}"], "variationId": "{{VariationId}}"}]""";

        var rules = ruleName is null
            ? "[]"
            : $$"""
                [{
                  "name": {{JsonSerializer.Serialize(ruleName)}},
                  "dispatchKey": null,
                  "includedInExpt": false,
                  "variations": [{"id": "{{VariationId}}", "rollout": [0, 1], "exptRollout": 1}]
                }]
                """;

        return $$"""
            {
              "key": "probe-flag",
              "isArchived": {{(isArchived ? "true" : "false")}},
              "isEnabled": {{(isEnabled ? "true" : "false")}},
              "disabledVariationId": "{{VariationId}}",
              "exptIncludeAllTargets": false,
              "targetUsers": {{targetUsers}},
              "rules": {{rules}},
              "fallthrough": {
                "dispatchKey": null,
                "includedInExpt": false,
                "variations": [{"id": "{{VariationId}}", "rollout": [0, 1], "exptRollout": 1}]
              }
            }
            """;
    }

    private sealed class StubRuleMatcher(bool matches) : IRuleMatcher
    {
        public ValueTask<bool> IsMatchAsync(JsonElement rule, EndUser user)
            => ValueTask.FromResult(matches);
    }
}
