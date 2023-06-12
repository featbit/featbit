using Domain.Evaluation;

namespace Domain.UnitTests.Evaluation;

public class DispatchAlgorithmTest
{
    [Theory]
    [InlineData("test-value", 0.14653629204258323)]
    [InlineData("qKPKh1S3FolC", 0.9105919692665339)]
    [InlineData("3eacb184-2d79-49df-9ea7-edd4f10e4c6f", 0.08994403155520558)]
    public void ReturnSameResultForAnGivenKey(string key, double value)
    {
        Assert.Equal(value, DispatchAlgorithm.RolloutOfKey(key));
    }
}