using Domain.FeatureFlags;

namespace Domain.UnitTests.FeatureFlags;

public class RolloutVariationTests
{
    private static readonly Variation[] FlagVariations =
    [
        new() { Id = "variation-1" },
        new() { Id = "variation-2" }
    ];

    [Fact]
    public void IsValid_KnownVariationAndValidRange_ReturnsTrue()
    {
        var variation = new RolloutVariation { Id = "variation-1", Rollout = [0, 1] };

        Assert.True(variation.IsValid(FlagVariations));
    }

    [Theory]
    [InlineData("unknown", 0, 1)]
    [InlineData("variation-1", -0.1, 1)]
    [InlineData("variation-1", 0, 1.1)]
    [InlineData("variation-1", 0.8, 0.2)]
    [InlineData("variation-1", double.NaN, 1)]
    [InlineData("variation-1", 0, double.PositiveInfinity)]
    public void IsValid_InvalidIdOrRange_ReturnsFalse(string id, double start, double end)
    {
        var variation = new RolloutVariation { Id = id, Rollout = [start, end] };

        Assert.False(variation.IsValid(FlagVariations));
    }

    [Fact]
    public void IsValid_RangeDoesNotHaveTwoValues_ReturnsFalse()
    {
        double[][] invalidRollouts = [[], [0], [0, 0.5, 1]];

        foreach (var rollout in invalidRollouts)
        {
            var variation = new RolloutVariation { Id = "variation-1", Rollout = rollout };
            Assert.False(variation.IsValid(FlagVariations));
        }
    }
}
