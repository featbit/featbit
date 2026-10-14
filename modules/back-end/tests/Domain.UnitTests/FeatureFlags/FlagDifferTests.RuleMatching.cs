using Domain.FeatureFlags;
using Domain.Targeting;

namespace Domain.UnitTests.FeatureFlags;

public class RuleMatchingDifferTests
{
    private static FeatureFlag Flag(params string[] keys) => new()
    {
        Variations = [new Variation { Id = "true", Value = "true" }],
        Rules = keys.Select((key, index) => new TargetRule
        {
            Id = Guid.NewGuid().ToString(), Name = $"Rule {index}", DispatchKey = key,
            Conditions = [new Condition { Property = "country", Op = "Equal", Value = "fr" }],
            Variations = [new RolloutVariation { Id = "true", Rollout = [0, 1] }]
        }).ToList()
    };

    [Fact]
    public void ExactMatchesAreReservedBeforeFallbackAndTargetsAreNotReused()
    {
        var source = Flag("new", "a", "other");
        var target = Flag("a", "b", "c");
        var diffs = FlagDiffer.CompareRules(source, target, []);
        Assert.Equal(3, diffs.Count);
        Assert.Equal(new[] { "b", "a", "c" }, diffs.Select(diff => diff.Target.DispatchKey));
        Assert.Equal(3, diffs.Select(diff => diff.Target.Id).Distinct().Count());
        Assert.Equal(new[] { true, false, true }, diffs.Select(diff => diff.CanAppend));
    }

    [Theory]
    [InlineData(1)]
    [InlineData(2)]
    public void DuplicateContentIsPairedOnceButNeverAppendedWhenAlreadyPresent(int targetCount)
    {
        var source = Flag("a", "a");
        var target = Flag(Enumerable.Repeat("a", targetCount).ToArray());
        var diffs = FlagDiffer.CompareRules(source, target, []);
        Assert.Equal(2, diffs.Count);
        Assert.Equal(targetCount, diffs.Count(diff => diff.Target != null));
        Assert.Equal(2 - targetCount, diffs.Count(diff => diff.IsDifferent));
        Assert.All(diffs, diff => Assert.False(diff.CanAppend));

        var options = new FlagSettingCopyOptions(false, new(false, CopyModes.Append),
            new(true, CopyModes.Append), false, false);
        FlagCopyHelper.CopySettings(new(source, target, [], options));
        Assert.Equal(targetCount, target.Rules.Count);
    }

    [Fact]
    public void OnlyUnmatchedTargetsAreReportedAsTargetOnly()
    {
        var source = Flag("a", "a");
        var target = Flag("a", "a", "b");
        var diffs = FlagDiffer.CompareRules(source, target, []);
        var targetOnly = Assert.Single(diffs, diff => diff.Source == null);
        Assert.Equal("b", targetOnly.Target.DispatchKey);
        Assert.False(targetOnly.CanAppend);
    }
}
