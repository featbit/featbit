using Domain.EndUsers;
using Domain.Evaluation;
using Domain.Insights;

namespace Domain.UnitTests.Insights;

public class InsightTests
{
    private static readonly HashSet<string> Disabled = new(StringComparer.Ordinal) { "off-a", "off-b" };

    private static bool IsDisabled(string key) => Disabled.Contains(key);

    private static VariationInsight Eval(string flagKey) => new()
    {
        FeatureFlagKey = flagKey,
        Variation = new Variation("v1", "true"),
        Timestamp = 1
    };

    private static Insight NewInsight(VariationInsight[] variations, MetricInsight[]? metrics = null) => new()
    {
        User = new EndUser { KeyId = "user-1" },
        Variations = variations,
        Metrics = metrics ?? []
    };

    [Fact]
    public void FilterDisabledFlags_AllEnabled_ReturnsUnchangedAndKeepsArray()
    {
        var variations = new[] { Eval("on-a"), Eval("on-b") };
        var insight = NewInsight(variations);

        var result = insight.FilterDisabledFlags(IsDisabled);

        Assert.Equal(InsightFilterResult.Unchanged, result);
        Assert.Same(variations, insight.Variations);
    }

    [Fact]
    public void FilterDisabledFlags_Mixed_KeepsEnabledInOrderAndReportsDropped()
    {
        var insight = NewInsight([Eval("off-a"), Eval("on-a"), Eval("off-b"), Eval("on-b")]);

        var result = insight.FilterDisabledFlags(IsDisabled);

        Assert.False(result.Skip);
        Assert.Equal(["off-a", "off-b"], result.DroppedFlagKeys);
        Assert.Equal(["on-a", "on-b"], insight.Variations!.Select(x => x!.FeatureFlagKey));
    }

    [Fact]
    public void FilterDisabledFlags_AllDisabledWithoutMetrics_Skips()
    {
        var insight = NewInsight([Eval("off-a"), Eval("off-b")]);

        var result = insight.FilterDisabledFlags(IsDisabled);

        Assert.True(result.Skip);
        Assert.Equal(2, result.DroppedFlagKeys.Count);
        Assert.Empty(insight.Variations!);
    }

    [Fact]
    public void FilterDisabledFlags_AllDisabledWithMetrics_KeepsMetricsAndDoesNotSkip()
    {
        var metric = new MetricInsight { Type = "Custom", EventName = "purchase" };
        var insight = NewInsight([Eval("off-a")], [metric]);

        var result = insight.FilterDisabledFlags(IsDisabled);

        Assert.False(result.Skip);
        Assert.Empty(insight.Variations!);
        Assert.Equal([metric], insight.Metrics!);
    }

    [Fact]
    public void FilterDisabledFlags_NoVariations_ReturnsUnchanged()
    {
        var insight = NewInsight([], [new MetricInsight { Type = "Custom", EventName = "purchase" }]);

        var result = insight.FilterDisabledFlags(IsDisabled);

        Assert.Equal(InsightFilterResult.Unchanged, result);
    }

    [Fact]
    public void FilterDisabledFlags_KeyDiffersOnlyByCase_IsNotDropped()
    {
        var insight = NewInsight([Eval("OFF-A")]);

        var result = insight.FilterDisabledFlags(IsDisabled);

        Assert.Equal(InsightFilterResult.Unchanged, result);
    }
}
