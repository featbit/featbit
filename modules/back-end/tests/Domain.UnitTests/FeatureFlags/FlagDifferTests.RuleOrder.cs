using Domain.FeatureFlags;
using Domain.Targeting;

namespace Domain.UnitTests.FeatureFlags;

public class RuleOrderDifferTests
{
    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public void ReorderingIsSeparateFromAppendDifferences(bool reverse)
    {
        TargetRule Rule(string id, string variation) => new()
        {
            Id = id,
            Conditions = [new Condition { Property = "country", Op = "Equal", Value = "fr" }],
            DispatchKey = "keyId",
            Variations = [new RolloutVariation { Id = variation, Rollout = [0, 1] }]
        };
        var source = new FeatureFlag
        {
            Variations = [new Variation { Id = "s-a", Value = "true" }, new Variation { Id = "s-b", Value = "false" }],
            Rules = [Rule("s1", "s-a"), Rule("s2", "s-b")]
        };
        var a = Rule("t1", "t-a");
        var b = Rule("t2", "t-b");
        var target = new FeatureFlag
        {
            Variations = [new Variation { Id = "t-a", Value = "true" }, new Variation { Id = "t-b", Value = "false" }],
            Rules = reverse ? [b, a] : [a, b]
        };

        var diffs = FlagDiffer.CompareRules(source, target, []);

        Assert.Equal(2, diffs.Count);
        Assert.All(diffs, diff =>
        {
            Assert.False(diff.IsDifferent);
            Assert.Equal(reverse, diff.IsOrderDifferent);
        });
        var originalOrder = target.Rules.ToArray();
        var append = new FlagSettingCopyOptions(false, new(false, CopyModes.Append),
            new(true, CopyModes.Append), false, false);
        FlagCopyHelper.CopySettings(new(source, target, [], append));
        Assert.Equal(originalOrder, target.Rules);

        var overwrite = append with { TargetingRule = new(true, CopyModes.Overwrite) };
        FlagCopyHelper.CopySettings(new(source, target, [], overwrite));
        Assert.Equal(new[] { "t-a", "t-b" }, target.Rules.Select(rule => rule.Variations.Single().Id));
        // CopySettings remaps the supplied source rules in place; compare with a fresh source snapshot.
        source.Rules = [Rule("s1", "s-a"), Rule("s2", "s-b")];
        Assert.All(FlagDiffer.CompareRules(source, target, []), diff =>
        {
            Assert.False(diff.IsDifferent);
            Assert.False(diff.IsOrderDifferent);
        });
    }
}
