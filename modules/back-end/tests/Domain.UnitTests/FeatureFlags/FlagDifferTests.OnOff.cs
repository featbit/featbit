using Domain.FeatureFlags;

namespace Domain.UnitTests.FeatureFlags;

public class OnOffDifferTests
{
    [Theory]
    [InlineData(true, false, true)]
    [InlineData(false, true, true)]
    [InlineData(true, true, false)]
    [InlineData(false, false, false)]
    public void OnOffDiff(bool source, bool target, bool expectedDiff)
    {
        var sourceFlag = new FeatureFlag { IsEnabled = source };
        var targetFlag = new FeatureFlag { IsEnabled = target };

        var diff = FlagDiffer.CompareOnOff(sourceFlag, targetFlag);
        Assert.Equal(expectedDiff, diff.IsDifferent);
    }
}