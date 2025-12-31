using Domain.FeatureFlags;

namespace Domain.UnitTests.FeatureFlags;

public class OffVariationDifferTests
{
    [Fact]
    public void SameOffVariation()
    {
        var sourceFlag = CreateFeatureFlag(
            variations:
            [
                new Variation { Id = "var1", Name = "Variation 1", Value = "true" },
                new Variation { Id = "var2", Name = "Variation 2", Value = "false" }
            ],
            disabledVariationId: "var2"
        );

        var targetFlag = CreateFeatureFlag(
            variations:
            [
                new Variation { Id = "var3", Name = "Variation 1", Value = "true" },
                new Variation { Id = "var4", Name = "Variation 2", Value = "false" }
            ],
            disabledVariationId: "var4" // Same value as source
        );

        var diff = FlagDiffer.CompareOffVariation(sourceFlag, targetFlag);

        Assert.False(diff.IsDifferent);
    }

    [Fact]
    public void DifferentOffVariation()
    {
        var sourceFlag = CreateFeatureFlag(
            variations:
            [
                new Variation { Id = "var1", Name = "Variation 1", Value = "true" },
                new Variation { Id = "var2", Name = "Variation 2", Value = "false" }
            ],
            disabledVariationId: "var1"
        );

        var targetFlag = CreateFeatureFlag(
            variations:
            [
                new Variation { Id = "var3", Name = "Variation 1", Value = "true" },
                new Variation { Id = "var4", Name = "Variation 2", Value = "false" }
            ],
            disabledVariationId: "var4" // Different value from source
        );

        var diff = FlagDiffer.CompareOffVariation(sourceFlag, targetFlag);

        Assert.True(diff.IsDifferent);
    }

    [Fact]
    public void SameOffVariationWithMultipleVariations()
    {
        var sourceFlag = CreateFeatureFlag(
            variations:
            [
                new Variation { Id = "var1", Name = "Variation 1", Value = "red" },
                new Variation { Id = "var2", Name = "Variation 2", Value = "green" },
                new Variation { Id = "var3", Name = "Variation 3", Value = "blue" }
            ],
            disabledVariationId: "var2"
        );

        var targetFlag = CreateFeatureFlag(
            variations:
            [
                new Variation { Id = "var4", Name = "Variation 1", Value = "red" },
                new Variation { Id = "var5", Name = "Variation 2", Value = "green" },
                new Variation { Id = "var6", Name = "Variation 3", Value = "blue" }
            ],
            disabledVariationId: "var5" // Same "green" value
        );

        var diff = FlagDiffer.CompareOffVariation(sourceFlag, targetFlag);

        Assert.False(diff.IsDifferent);
    }

    [Fact]
    public void OffVariationNotFoundInSourceThrowsException()
    {
        var sourceFlag = CreateFeatureFlag(
            variations:
            [
                new Variation { Id = "var1", Name = "Variation 1", Value = "true" }
            ],
            disabledVariationId: "nonexistent"
        );

        var targetFlag = CreateFeatureFlag(
            variations:
            [
                new Variation { Id = "var2", Name = "Variation 1", Value = "true" }
            ],
            disabledVariationId: "var2"
        );

        var exception = Assert.Throws<Exception>(() =>
            FlagDiffer.CompareOffVariation(sourceFlag, targetFlag)
        );

        Assert.Contains("disabled variation not found in source flag", exception.Message);
    }

    [Fact]
    public void OffVariationNotFoundInTargetThrowsException()
    {
        var sourceFlag = CreateFeatureFlag(
            variations:
            [
                new Variation { Id = "var1", Name = "Variation 1", Value = "true" }
            ],
            disabledVariationId: "var1"
        );

        var targetFlag = CreateFeatureFlag(
            variations:
            [
                new Variation { Id = "var2", Name = "Variation 1", Value = "true" }
            ],
            disabledVariationId: "nonexistent"
        );

        var exception = Assert.Throws<Exception>(() =>
            FlagDiffer.CompareOffVariation(sourceFlag, targetFlag)
        );

        Assert.Contains("disabled variation not found in target flag", exception.Message);
    }

    private static FeatureFlag CreateFeatureFlag(ICollection<Variation> variations, string disabledVariationId)
    {
        return new FeatureFlag
        {
            Variations = variations,
            DisabledVariationId = disabledVariationId
        };
    }
}