using Domain.FeatureFlags;

namespace Domain.UnitTests.FeatureFlags;

public class DefaultRuleDifferTests
{
    [Fact]
    public void SameDefaultRule()
    {
        var sourceFlag = CreateFeatureFlag(
            variations:
            [
                new Variation { Id = "var1", Name = "Variation 1", Value = "true" },
                new Variation { Id = "var2", Name = "Variation 2", Value = "false" }
            ],
            fallthrough: new Fallthrough
            {
                DispatchKey = "keyId",
                Variations =
                [
                    new RolloutVariation { Id = "var1", Rollout = [0, 0.5] },
                    new RolloutVariation { Id = "var2", Rollout = [0.5, 1] }
                ]
            }
        );

        var targetFlag = CreateFeatureFlag(
            variations:
            [
                new Variation { Id = "var3", Name = "Variation 1", Value = "true" },
                new Variation { Id = "var4", Name = "Variation 2", Value = "false" }
            ],
            fallthrough: new Fallthrough
            {
                DispatchKey = "keyId",
                Variations =
                [
                    new RolloutVariation { Id = "var3", Rollout = [0, 0.5] },
                    new RolloutVariation { Id = "var4", Rollout = [0.5, 1] }
                ]
            }
        );

        var diff = FlagDiffer.CompareDefaultRule(sourceFlag, targetFlag);

        Assert.False(diff.IsDifferent);
    }

    [Fact]
    public void DifferentDispatchKey()
    {
        var sourceFlag = CreateFeatureFlag(
            variations:
            [
                new Variation { Id = "var1", Name = "Variation 1", Value = "true" },
                new Variation { Id = "var2", Name = "Variation 2", Value = "false" }
            ],
            fallthrough: new Fallthrough
            {
                DispatchKey = "keyId",
                Variations =
                [
                    new RolloutVariation { Id = "var1", Rollout = [0, 0.5] },
                    new RolloutVariation { Id = "var2", Rollout = [0.5, 1] }
                ]
            }
        );

        var targetFlag = CreateFeatureFlag(
            variations:
            [
                new Variation { Id = "var3", Name = "Variation 1", Value = "true" },
                new Variation { Id = "var4", Name = "Variation 2", Value = "false" }
            ],
            fallthrough: new Fallthrough
            {
                DispatchKey = "userId",
                Variations =
                [
                    new RolloutVariation { Id = "var3", Rollout = [0, 0.5] },
                    new RolloutVariation { Id = "var4", Rollout = [0.5, 1] }
                ]
            }
        );

        var diff = FlagDiffer.CompareDefaultRule(sourceFlag, targetFlag);
        Assert.True(diff.IsDifferent);
    }

    [Fact]
    public void DifferentRolloutPercentages()
    {
        var sourceFlag = CreateFeatureFlag(
            variations:
            [
                new Variation { Id = "var1", Name = "Variation 1", Value = "true" },
                new Variation { Id = "var2", Name = "Variation 2", Value = "false" }
            ],
            fallthrough: new Fallthrough
            {
                DispatchKey = "keyId",
                Variations =
                [
                    new RolloutVariation { Id = "var1", Rollout = [0, 0.5] },
                    new RolloutVariation { Id = "var2", Rollout = [0.5, 1] }
                ]
            }
        );

        var targetFlag = CreateFeatureFlag(
            variations:
            [
                new Variation { Id = "var3", Name = "Variation 1", Value = "true" },
                new Variation { Id = "var4", Name = "Variation 2", Value = "false" }
            ],
            fallthrough: new Fallthrough
            {
                DispatchKey = "keyId",
                Variations =
                [
                    new RolloutVariation { Id = "var3", Rollout = [0, 0.7] }, // Different percentage
                    new RolloutVariation { Id = "var4", Rollout = [0.7, 1] }
                ]
            }
        );

        var diff = FlagDiffer.CompareDefaultRule(sourceFlag, targetFlag);

        Assert.True(diff.IsDifferent);
    }

    [Fact]
    public void DifferentServedVariation()
    {
        var sourceFlag = CreateFeatureFlag(
            variations:
            [
                new Variation { Id = "var1", Name = "Variation 1", Value = "true" },
                new Variation { Id = "var2", Name = "Variation 2", Value = "false" }
            ],
            fallthrough: new Fallthrough
            {
                Variations =
                [
                    new RolloutVariation { Id = "var1", Rollout = [0, 1] }
                ]
            }
        );

        var targetFlag = CreateFeatureFlag(
            variations:
            [
                new Variation { Id = "var3", Name = "Variation 1", Value = "true" },
                new Variation { Id = "var4", Name = "Variation 2", Value = "false" }
            ],
            fallthrough: new Fallthrough
            {
                Variations =
                [
                    new RolloutVariation { Id = "var4", Rollout = [0, 1] } // Different variation served
                ]
            }
        );

        var diff = FlagDiffer.CompareDefaultRule(sourceFlag, targetFlag);

        Assert.True(diff.IsDifferent);
    }

    [Fact]
    public void SameDefaultRuleWithMultipleVariations()
    {
        var sourceFlag = CreateFeatureFlag(
            variations:
            [
                new Variation { Id = "var1", Name = "Variation 1", Value = "red" },
                new Variation { Id = "var2", Name = "Variation 2", Value = "green" },
                new Variation { Id = "var3", Name = "Variation 3", Value = "blue" }
            ],
            fallthrough: new Fallthrough
            {
                DispatchKey = "keyId",
                Variations =
                [
                    new RolloutVariation { Id = "var1", Rollout = [0, 0.33] },
                    new RolloutVariation { Id = "var2", Rollout = [0.33, 0.66] },
                    new RolloutVariation { Id = "var3", Rollout = [0.66, 1] }
                ]
            }
        );

        var targetFlag = CreateFeatureFlag(
            variations:
            [
                new Variation { Id = "var4", Name = "Variation 1", Value = "red" },
                new Variation { Id = "var5", Name = "Variation 2", Value = "green" },
                new Variation { Id = "var6", Name = "Variation 3", Value = "blue" }
            ],
            fallthrough: new Fallthrough
            {
                DispatchKey = "keyId",
                Variations =
                [
                    new RolloutVariation { Id = "var4", Rollout = [0, 0.33] },
                    new RolloutVariation { Id = "var5", Rollout = [0.33, 0.66] },
                    new RolloutVariation { Id = "var6", Rollout = [0.66, 1] }
                ]
            }
        );

        var diff = FlagDiffer.CompareDefaultRule(sourceFlag, targetFlag);

        Assert.False(diff.IsDifferent);
    }

    [Fact]
    public void VariationRemovedFromDefaultRule()
    {
        var sourceFlag = CreateFeatureFlag(
            variations:
            [
                new Variation { Id = "var1", Name = "Variation 1", Value = "true" },
                new Variation { Id = "var2", Name = "Variation 2", Value = "false" }
            ],
            fallthrough: new Fallthrough
            {
                DispatchKey = "keyId",
                Variations =
                [
                    new RolloutVariation { Id = "var1", Rollout = [0, 0.5] },
                    new RolloutVariation { Id = "var2", Rollout = [0.5, 1] }
                ]
            }
        );

        var targetFlag = CreateFeatureFlag(
            variations:
            [
                new Variation { Id = "var3", Name = "Variation 1", Value = "true" }
            ],
            fallthrough: new Fallthrough
            {
                Variations =
                [
                    new RolloutVariation { Id = "var3", Rollout = [0, 1] }
                ]
            }
        );

        var diff = FlagDiffer.CompareDefaultRule(sourceFlag, targetFlag);
        Assert.True(diff.IsDifferent);
    }

    [Fact]
    public void SingleVariationDefaultRule()
    {
        var sourceFlag = CreateFeatureFlag(
            variations:
            [
                new Variation { Id = "var1", Name = "Variation 1", Value = "value1" }
            ],
            fallthrough: new Fallthrough
            {
                Variations =
                [
                    new RolloutVariation { Id = "var1", Rollout = [0, 1] }
                ]
            }
        );

        var targetFlag = CreateFeatureFlag(
            variations:
            [
                new Variation { Id = "var2", Name = "Variation 1", Value = "value1" }
            ],
            fallthrough: new Fallthrough
            {
                Variations =
                [
                    new RolloutVariation { Id = "var2", Rollout = [0, 1] }
                ]
            }
        );

        var diff = FlagDiffer.CompareDefaultRule(sourceFlag, targetFlag);
        Assert.False(diff.IsDifferent);
    }

    private static FeatureFlag CreateFeatureFlag(ICollection<Variation> variations, Fallthrough fallthrough)
    {
        return new FeatureFlag
        {
            Variations = variations,
            Fallthrough = fallthrough,
        };
    }
}