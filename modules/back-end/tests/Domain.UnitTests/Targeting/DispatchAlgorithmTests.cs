using Domain.Targeting;

namespace Domain.UnitTests.Targeting;

public class DispatchAlgorithmTests
{
    [Fact]
    public void IsInRollout_NearCompleteRollout_DoesNotSwallowTail()
    {
        const string key = "audit-flaguser-482388";

        Assert.False(DispatchAlgorithm.IsInRollout(key, [0, 0.999995]));
        Assert.True(DispatchAlgorithm.IsInRollout(key, [0.999995, 1]));
        Assert.True(DispatchAlgorithm.IsInRollout(key, [0, 1]));
        Assert.False(DispatchAlgorithm.IsInRollout(key, [0, 0]));
    }

    [Theory]
    [InlineData("test-value", 0.14653629204258323)]
    [InlineData("qKPKh1S3FolC", 0.9105919692665339)]
    [InlineData("3eacb184-2d79-49df-9ea7-edd4f10e4c6f", 0.08994403155520558)]
    public void RolloutOfKey_GivenKey_ReturnsDeterministicValue(string key, double value)
    {
        Assert.Equal(value, DispatchAlgorithm.RolloutOfKey(key));
    }
}
