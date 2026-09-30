using Application.FeatureFlags;
using Domain.FeatureFlags;
using Domain.Targeting;

namespace Application.UnitTests.FeatureFlags;

public class FlagDiffOverviewTests
{
    [Theory]
    [InlineData(false, false, false)]
    [InlineData(true, false, true)]
    [InlineData(false, true, true)]
    public void TargetingRuleIncludesContentAndOrderDifferences(bool contentDifferent, bool orderDifferent, bool expected)
    {
        var diff = new FlagDiff(
            new OnOffDiff(true, true, false),
            [],
            [new TargetingRuleDiff(new TargetRule(), new TargetRule(), contentDifferent)
            {
                IsOrderDifferent = orderDifferent
            }],
            new DefaultRuleDiff(new Fallthrough(), new Fallthrough(), false),
            new OffVariationDiff(new Variation(), new Variation(), false));

        var overview = new FlagDiffOverview(Guid.NewGuid(), diff);

        Assert.Equal(expected, overview.TargetingRule);
    }
}
