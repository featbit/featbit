using Domain.FeatureFlags;
using Domain.Targeting;

namespace Domain.UnitTests.FeatureFlags;

public class IndividualTargetingDifferTests
{
    [Fact]
    public void NoTargetUsers()
    {
        var source = CreateFeatureFlag(
            variations:
            [
                new Variation { Id = "var1", Name = "Variation 1", Value = "true" },
                new Variation { Id = "var2", Name = "Variation 2", Value = "false" }
            ],
            targetUsers:
            [
                new TargetUser { VariationId = "var1", KeyIds = [] },
                new TargetUser { VariationId = "var2", KeyIds = [] }
            ]
        );

        var target = CreateFeatureFlag(
            variations:
            [
                new Variation { Id = "var3", Name = "Variation 1", Value = "true" },
                new Variation { Id = "var4", Name = "Variation 2", Value = "false" }
            ],
            targetUsers:
            [
                new TargetUser { VariationId = "var3", KeyIds = [] },
                new TargetUser { VariationId = "var4", KeyIds = [] }
            ]
        );

        var diffs = FlagDiffer.CompareIndividualTargeting(source, target);

        Assert.Equal(2, diffs.Count);
        Assert.All(diffs, diff => Assert.False(diff.IsDifferent));
    }

    [Fact]
    public void SameTargetingUser()
    {
        var sourceFlag = CreateFeatureFlag(
            variations:
            [
                new Variation { Id = "var1", Name = "Variation 1", Value = "true" },
                new Variation { Id = "var2", Name = "Variation 2", Value = "false" }
            ],
            targetUsers:
            [
                new TargetUser { VariationId = "var1", KeyIds = ["user1", "user2"] },
                new TargetUser { VariationId = "var2", KeyIds = ["user3"] }
            ]
        );

        var targetFlag = CreateFeatureFlag(
            variations:
            [
                new Variation { Id = "var3", Name = "Variation 1", Value = "true" },
                new Variation { Id = "var4", Name = "Variation 2", Value = "false" }
            ],
            targetUsers:
            [
                new TargetUser { VariationId = "var3", KeyIds = ["user1", "user2"] },
                new TargetUser { VariationId = "var4", KeyIds = ["user3"] }
            ]
        );

        var diffs = FlagDiffer.CompareIndividualTargeting(sourceFlag, targetFlag);

        Assert.Equal(2, diffs.Count);
        Assert.All(diffs, diff => Assert.False(diff.IsDifferent));
    }

    [Fact]
    public void DifferentTargetUsers()
    {
        var sourceFlag = CreateFeatureFlag(
            variations:
            [
                new Variation { Id = "var1", Name = "Variation 1", Value = "true" },
                new Variation { Id = "var2", Name = "Variation 2", Value = "false" }
            ],
            targetUsers:
            [
                new TargetUser { VariationId = "var1", KeyIds = ["user1", "user2"] },
                new TargetUser { VariationId = "var2", KeyIds = ["user3"] }
            ]
        );

        var targetFlag = CreateFeatureFlag(
            variations:
            [
                new Variation { Id = "var3", Name = "Variation 1", Value = "true" },
                new Variation { Id = "var4", Name = "Variation 2", Value = "false" }
            ],
            targetUsers:
            [
                // Different user
                new TargetUser { VariationId = "var3", KeyIds = ["user1", "user4"] },

                // Additional user
                new TargetUser { VariationId = "var4", KeyIds = ["user3", "user5"] }
            ]
        );

        var diffs = FlagDiffer.CompareIndividualTargeting(sourceFlag, targetFlag);

        Assert.Equal(2, diffs.Count);
        Assert.True(diffs[0].IsDifferent);
        Assert.True(diffs[1].IsDifferent);
    }

    [Fact]
    public void VariationRemovedWithTargetUsers()
    {
        var sourceFlag = CreateFeatureFlag(
            variations:
            [
                new Variation { Id = "var1", Name = "Variation 1", Value = "true" },
                new Variation { Id = "var2", Name = "Variation 2", Value = "false" }
            ],
            targetUsers:
            [
                new TargetUser { VariationId = "var1", KeyIds = ["user1", "user2"] },
                new TargetUser { VariationId = "var2", KeyIds = ["user3"] }
            ]
        );

        var targetFlag = CreateFeatureFlag(
            variations:
            [
                new Variation { Id = "var3", Name = "Variation 1", Value = "true" }
            ],
            targetUsers:
            [
                new TargetUser { VariationId = "var3", KeyIds = ["user1", "user2"] }
            ]
        );

        var diffs = FlagDiffer.CompareIndividualTargeting(sourceFlag, targetFlag);

        Assert.Equal(2, diffs.Count);
        Assert.False(diffs[0].IsDifferent); // First variation unchanged
        Assert.True(diffs[1].IsDifferent); // Second variation removed with target users
    }

    [Fact]
    public void VariationRemovedWithoutTargetUsers()
    {
        var sourceFlag = CreateFeatureFlag(
            variations:
            [
                new Variation { Id = "var1", Name = "Variation 1", Value = "true" },
                new Variation { Id = "var2", Name = "Variation 2", Value = "false" }
            ],
            targetUsers:
            [
                new TargetUser { VariationId = "var1", KeyIds = ["user1", "user2"] },
                // No target users for var2
                new TargetUser { VariationId = "var2", KeyIds = [] }
            ]
        );

        var targetFlag = CreateFeatureFlag(
            variations:
            [
                new Variation { Id = "var3", Name = "Variation 1", Value = "true" }
            ],
            targetUsers:
            [
                new TargetUser { VariationId = "var3", KeyIds = ["user1", "user2"] }
            ]
        );

        var diffs = FlagDiffer.CompareIndividualTargeting(sourceFlag, targetFlag);

        Assert.Equal(2, diffs.Count);
        Assert.False(diffs[0].IsDifferent);

        // since var2 has no target users, so no diff is reported for removed variation
        Assert.False(diffs[1].IsDifferent);
    }

    [Fact]
    public void TargetUsersOrderDifferent()
    {
        var sourceFlag = CreateFeatureFlag(
            variations:
            [
                new Variation { Id = "var1", Name = "Variation 1", Value = "true" }
            ],
            targetUsers:
            [
                new TargetUser { VariationId = "var1", KeyIds = ["user1", "user2", "user3"] }
            ]
        );

        var targetFlag = CreateFeatureFlag(
            variations:
            [
                new Variation { Id = "var2", Name = "Variation 1", Value = "true" }
            ],
            targetUsers:
            [
                new TargetUser { VariationId = "var2", KeyIds = ["user3", "user1", "user2"] } // Different order
            ]
        );

        var diffs = FlagDiffer.CompareIndividualTargeting(sourceFlag, targetFlag);

        Assert.Single(diffs);
        Assert.False(diffs[0].IsDifferent); // Order should not matter
    }

    [Fact]
    public void TargetUsersAddedToVariation()
    {
        var sourceFlag = CreateFeatureFlag(
            variations:
            [
                new Variation { Id = "var1", Name = "Variation 1", Value = "true" }
            ],
            targetUsers:
            [
                new TargetUser { VariationId = "var1", KeyIds = [] }
            ]
        );

        var targetFlag = CreateFeatureFlag(
            variations:
            [
                new Variation { Id = "var2", Name = "Variation 1", Value = "true" }
            ],
            targetUsers:
            [
                new TargetUser { VariationId = "var2", KeyIds = ["user1"] }
            ]
        );

        var diffs = FlagDiffer.CompareIndividualTargeting(sourceFlag, targetFlag);

        Assert.Single(diffs);
        Assert.True(diffs[0].IsDifferent);
    }

    [Fact]
    public void TargetUsersRemovedFromVariation()
    {
        var sourceFlag = CreateFeatureFlag(
            variations:
            [
                new Variation { Id = "var1", Name = "Variation 1", Value = "true" }
            ],
            targetUsers:
            [
                new TargetUser { VariationId = "var1", KeyIds = ["user1", "user2"] }
            ]
        );

        var targetFlag = CreateFeatureFlag(
            variations:
            [
                new Variation { Id = "var2", Name = "Variation 1", Value = "true" }
            ],
            targetUsers:
            [
                new TargetUser { VariationId = "var1", KeyIds = [] }
            ]
        );

        var diffs = FlagDiffer.CompareIndividualTargeting(sourceFlag, targetFlag);

        Assert.Single(diffs);
        Assert.True(diffs[0].IsDifferent);
    }

    [Fact]
    public void NewVariationAddedWithTargetUsers()
    {
        var sourceFlag = CreateFeatureFlag(
            variations:
            [
                new Variation { Id = "var1", Name = "Variation 1", Value = "true" }
            ],
            targetUsers:
            [
                new TargetUser { VariationId = "var1", KeyIds = ["user1"] }
            ]
        );

        var targetFlag = CreateFeatureFlag(
            variations:
            [
                new Variation { Id = "var2", Name = "Variation 1", Value = "true" },
                new Variation { Id = "var3", Name = "Variation 2", Value = "false" }
            ],
            targetUsers:
            [
                new TargetUser { VariationId = "var2", KeyIds = ["user1"] },
                new TargetUser { VariationId = "var3", KeyIds = ["user2", "user3"] }
            ]
        );

        var diffs = FlagDiffer.CompareIndividualTargeting(sourceFlag, targetFlag);

        Assert.Equal(2, diffs.Count);
        Assert.False(diffs[0].IsDifferent); // First variation unchanged

        Assert.True(diffs[1].IsDifferent); // New variation added with users
        Assert.Null(diffs[1].Source); // Source should be null for new variation
        Assert.NotNull(diffs[1].Target);
    }

    [Fact]
    public void NewVariationAddedWithoutTargetUsers()
    {
        var sourceFlag = CreateFeatureFlag(
            variations:
            [
                new Variation { Id = "var1", Name = "Variation 1", Value = "true" }
            ],
            targetUsers:
            [
                new TargetUser { VariationId = "var1", KeyIds = ["user1"] }
            ]
        );

        var targetFlag = CreateFeatureFlag(
            variations:
            [
                new Variation { Id = "var2", Name = "Variation 1", Value = "true" },
                new Variation { Id = "var3", Name = "Variation 2", Value = "false" }
            ],
            targetUsers:
            [
                new TargetUser { VariationId = "var2", KeyIds = ["user1"] },
                new TargetUser { VariationId = "var3", KeyIds = [] }
            ]
        );

        var diffs = FlagDiffer.CompareIndividualTargeting(sourceFlag, targetFlag);

        Assert.Equal(2, diffs.Count);
        Assert.False(diffs[0].IsDifferent); // First variation unchanged

        Assert.False(diffs[1].IsDifferent); // New variation added without users - no diff
        Assert.Null(diffs[1].Source); // Source should be null for new variation
        Assert.NotNull(diffs[1].Target);
    }

    [Fact]
    public void MultipleVariationsWithMixedChanges()
    {
        var sourceFlag = CreateFeatureFlag(
            variations:
            [
                new Variation { Id = "var1", Name = "Variation 1", Value = "red" },
                new Variation { Id = "var2", Name = "Variation 2", Value = "green" },
                new Variation { Id = "var3", Name = "Variation 3", Value = "blue" }
            ],
            targetUsers:
            [
                new TargetUser { VariationId = "var1", KeyIds = ["user1", "user2"] },
                new TargetUser { VariationId = "var2", KeyIds = ["user3"] },
                new TargetUser { VariationId = "var3", KeyIds = [] }
            ]
        );

        var targetFlag = CreateFeatureFlag(
            variations:
            [
                new Variation { Id = "var4", Name = "Variation 1", Value = "red" },
                new Variation { Id = "var5", Name = "Variation 2", Value = "green" },
                new Variation { Id = "var6", Name = "Variation 4", Value = "yellow" }
            ],
            targetUsers:
            [
                new TargetUser { VariationId = "var4", KeyIds = ["user1", "user2"] }, // Same as source
                new TargetUser { VariationId = "var5", KeyIds = ["user3", "user4"] }, // Different from source
                new TargetUser { VariationId = "var6", KeyIds = ["user5"] } // New variation
            ]
        );

        var diffs = FlagDiffer.CompareIndividualTargeting(sourceFlag, targetFlag);

        Assert.Equal(4, diffs.Count);

        // red variation - unchanged
        Assert.False(diffs[0].IsDifferent);
        Assert.Equal("red", diffs[0].Source.Variation.Value);

        // green variation - users changed
        Assert.True(diffs[1].IsDifferent);
        Assert.Equal("green", diffs[1].Source.Variation.Value);

        // blue variation - removed but had no users
        Assert.False(diffs[2].IsDifferent);
        Assert.Equal("blue", diffs[2].Source.Variation.Value);
        Assert.Null(diffs[2].Target);

        // yellow variation - new with users
        Assert.True(diffs[3].IsDifferent);
        Assert.Null(diffs[3].Source);
        Assert.Equal("yellow", diffs[3].Target.Variation.Value);
    }

    [Fact]
    public void PartialUserOverlap()
    {
        var sourceFlag = CreateFeatureFlag(
            variations:
            [
                new Variation { Id = "var1", Name = "Variation 1", Value = "true" }
            ],
            targetUsers:
            [
                new TargetUser { VariationId = "var1", KeyIds = ["user1", "user2", "user3"] }
            ]
        );

        var targetFlag = CreateFeatureFlag(
            variations:
            [
                new Variation { Id = "var2", Name = "Variation 1", Value = "true" }
            ],
            targetUsers:
            [
                new TargetUser { VariationId = "var2", KeyIds = ["user2", "user3", "user4"] } // Overlap: user2, user3
            ]
        );

        var diffs = FlagDiffer.CompareIndividualTargeting(sourceFlag, targetFlag);

        Assert.Single(diffs);
        Assert.True(diffs[0].IsDifferent); // Different because user1 removed and user4 added
    }

    private static FeatureFlag CreateFeatureFlag(ICollection<Variation> variations, ICollection<TargetUser> targetUsers)
    {
        return new FeatureFlag
        {
            Variations = variations,
            TargetUsers = targetUsers
        };
    }
}