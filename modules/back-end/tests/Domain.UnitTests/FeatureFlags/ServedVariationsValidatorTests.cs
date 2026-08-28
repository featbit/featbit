using Domain.FeatureFlags;

namespace Domain.UnitTests.FeatureFlags;

public class ServedVariationsValidatorTests
{
    private static readonly Variation[] FlagVariations =
    [
        new() { Id = "variation-1" },
        new() { Id = "variation-2" }
    ];

    [Fact]
    public void IsValid_ContinuousRolloutCoveringOneHundredPercent_ReturnsTrue()
    {
        RolloutVariation[] servedVariations =
        [
            new() { Id = "variation-1", Rollout = [0, 0.4] },
            new() { Id = "variation-2", Rollout = [0.4, 1] }
        ];

        Assert.True(ServedVariationsValidator.IsValid(servedVariations, FlagVariations));
    }

    [Theory]
    [InlineData(0, 0.4, 0.5, 1)]
    [InlineData(0, 0.6, 0.5, 1)]
    [InlineData(0.1, 0.5, 0.5, 1)]
    [InlineData(0, 0.5, 0.5, 0.9)]
    public void IsValid_RolloutDoesNotCompletelyAllocateOneHundredPercent_ReturnsFalse(
        double firstStart,
        double firstEnd,
        double secondStart,
        double secondEnd)
    {
        RolloutVariation[] servedVariations =
        [
            new() { Id = "variation-1", Rollout = [firstStart, firstEnd] },
            new() { Id = "variation-2", Rollout = [secondStart, secondEnd] }
        ];

        Assert.False(ServedVariationsValidator.IsValid(servedVariations, FlagVariations));
    }

    [Fact]
    public void IsValid_UnknownVariationId_ReturnsFalse()
    {
        RolloutVariation[] servedVariations =
        [
            new() { Id = "unknown", Rollout = [0, 1] }
        ];

        Assert.False(ServedVariationsValidator.IsValid(servedVariations, FlagVariations));
    }

    [Fact]
    public void IsValid_NoServedVariations_ReturnsFalse()
    {
        Assert.False(ServedVariationsValidator.IsValid([], FlagVariations));
    }
}
