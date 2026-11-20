using Domain.Evaluation;

namespace Domain.UnitTests.Evaluation;

public class DispatchAlgorithmTests
{
    [Fact]
    public void IsInRollout_NearCompleteRollout_DoesNotSwallowTail()
    {
        const string key = "audit-flaguser-482388";

        Assert.Equal(0.9999995538964868, DispatchAlgorithm.RolloutOfKey(key));
        Assert.False(DispatchAlgorithm.IsInRollout(key, [0, 0.999995]));
        Assert.True(DispatchAlgorithm.IsInRollout(key, [0.999995, 1]));
        Assert.True(DispatchAlgorithm.IsInRollout(key, [0, 1]));
        Assert.False(DispatchAlgorithm.IsInRollout(key, [0, 0]));
    }

    [Fact]
    public void RolloutUserVariation_NearCompleteFirstVariation_SelectsTailVariation()
    {
        using var json = System.Text.Json.JsonDocument.Parse("""
            [{"id":"a","rollout":[0,0.999995],"exptRollout":0},
             {"id":"b","rollout":[0.999995,1],"exptRollout":0}]
            """);

        var result = new RolloutUserVariation(json.RootElement, "audit-flaguser-482388",
            [new("a", "A"), new("b", "B")], false, false, "default");

        Assert.Equal("b", result.Variation!.Id);
    }

    [Theory]
    [InlineData("test-value", 0.14653629204258323)]
    [InlineData("qKPKh1S3FolC", 0.9105919692665339)]
    [InlineData("3eacb184-2d79-49df-9ea7-edd4f10e4c6f", 0.08994403155520558)]
    public void RolloutOfKey_GivenKey_ReturnsDeterministicValue(string key, double expected)
    {
        Assert.Equal(expected, DispatchAlgorithm.RolloutOfKey(key));
    }
}
