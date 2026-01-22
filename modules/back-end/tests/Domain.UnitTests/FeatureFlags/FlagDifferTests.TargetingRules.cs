using Domain.FeatureFlags;
using Domain.Segments;
using Domain.Targeting;

namespace Domain.UnitTests.FeatureFlags;

public class TargetingRulesDifferTests
{
    [Fact]
    public void NoRules()
    {
        var sourceFlag = CreateFeatureFlag(
            variations:
            [
                new Variation { Id = "var1", Name = "Variation 1", Value = "true" }
            ],
            rules: []
        );

        var targetFlag = CreateFeatureFlag(
            variations:
            [
                new Variation { Id = "var2", Name = "Variation 1", Value = "true" }
            ],
            rules: []
        );

        var diffs = FlagDiffer.CompareRules(sourceFlag, targetFlag, []);

        Assert.Empty(diffs);
    }

    [Fact]
    public void SameRules()
    {
        var sourceFlag = CreateFeatureFlag(
            variations:
            [
                new Variation { Id = "var1", Name = "Variation 1", Value = "true" },
                new Variation { Id = "var2", Name = "Variation 2", Value = "false" }
            ],
            rules:
            [
                new TargetRule
                {
                    Conditions =
                    [
                        new Condition { Property = "country", Op = "Equal", Value = "US" }
                    ],
                    Variations =
                    [
                        new RolloutVariation { Id = "var1", Rollout = [0, 1] }
                    ]
                }
            ]
        );

        var targetFlag = CreateFeatureFlag(
            variations:
            [
                new Variation { Id = "var3", Name = "Variation 1", Value = "true" },
                new Variation { Id = "var4", Name = "Variation 2", Value = "false" }
            ],
            rules:
            [
                new TargetRule
                {
                    Conditions =
                    [
                        new Condition { Property = "country", Op = "Equal", Value = "US" }
                    ],
                    Variations =
                    [
                        new RolloutVariation { Id = "var3", Rollout = [0, 1] }
                    ]
                }
            ]
        );

        var diffs = FlagDiffer.CompareRules(sourceFlag, targetFlag, []);

        Assert.Single(diffs);
        Assert.False(diffs[0].IsDifferent);
    }

    [Fact]
    public void DifferentConditions()
    {
        var sourceFlag = CreateFeatureFlag(
            variations:
            [
                new Variation { Id = "var1", Name = "Variation 1", Value = "true" }
            ],
            rules:
            [
                new TargetRule
                {
                    Conditions =
                    [
                        new Condition { Property = "country", Op = "Equal", Value = "US" }
                    ],
                    Variations =
                    [
                        new RolloutVariation { Id = "var1", Rollout = [0, 1] }
                    ]
                }
            ]
        );

        var targetFlag = CreateFeatureFlag(
            variations:
            [
                new Variation { Id = "var2", Name = "Variation 1", Value = "true" }
            ],
            rules:
            [
                new TargetRule
                {
                    Conditions =
                    [
                        new Condition { Property = "country", Op = "Equal", Value = "CA" } // Different country
                    ],
                    Variations =
                    [
                        new RolloutVariation { Id = "var2", Rollout = [0, 1] }
                    ]
                }
            ]
        );

        var diffs = FlagDiffer.CompareRules(sourceFlag, targetFlag, []);

        Assert.Equal(2, diffs.Count);
        Assert.All(diffs, diff => Assert.True(diff.IsDifferent));
    }

    [Fact]
    public void RuleRemoved()
    {
        var sourceFlag = CreateFeatureFlag(
            variations:
            [
                new Variation { Id = "var1", Name = "Variation 1", Value = "true" }
            ],
            rules:
            [
                new TargetRule
                {
                    Id = "rule1",
                    Conditions =
                    [
                        new Condition { Property = "country", Op = "Equal", Value = "US" }
                    ],
                    Variations =
                    [
                        new RolloutVariation { Id = "var1", Rollout = [0, 1] }
                    ]
                }
            ]
        );

        var targetFlag = CreateFeatureFlag(
            variations:
            [
                new Variation { Id = "var2", Name = "Variation 1", Value = "true" }
            ],
            rules: [] // No rules in target
        );

        var diffs = FlagDiffer.CompareRules(sourceFlag, targetFlag, []);

        Assert.Single(diffs);
        Assert.True(diffs[0].IsDifferent);
        Assert.Null(diffs[0].Target);
    }

    [Fact]
    public void RuleWithDifferentServedVariation()
    {
        var sourceFlag = CreateFeatureFlag(
            variations:
            [
                new Variation { Id = "var1", Name = "Variation 1", Value = "true" },
                new Variation { Id = "var2", Name = "Variation 2", Value = "false" }
            ],
            rules:
            [
                new TargetRule
                {
                    Conditions =
                    [
                        new Condition { Property = "country", Op = "Equal", Value = "US" }
                    ],
                    Variations =
                    [
                        new RolloutVariation { Id = "var1", Rollout = [0, 1] }
                    ]
                }
            ]
        );

        var targetFlag = CreateFeatureFlag(
            variations:
            [
                new Variation { Id = "var3", Name = "Variation 1", Value = "true" },
                new Variation { Id = "var4", Name = "Variation 2", Value = "false" }
            ],
            rules:
            [
                new TargetRule
                {
                    Conditions =
                    [
                        new Condition { Property = "country", Op = "Equal", Value = "US" }
                    ],
                    Variations =
                    [
                        new RolloutVariation { Id = "var4", Rollout = [0, 1] } // Different variation
                    ]
                }
            ]
        );

        var diffs = FlagDiffer.CompareRules(sourceFlag, targetFlag, []);

        Assert.Single(diffs);
        Assert.True(diffs[0].IsDifferent);
    }

    [Fact]
    public void RuleWithDifferentRolloutPercentages()
    {
        var sourceFlag = CreateFeatureFlag(
            variations:
            [
                new Variation { Id = "var1", Name = "Variation 1", Value = "true" },
                new Variation { Id = "var2", Name = "Variation 2", Value = "false" }
            ],
            rules:
            [
                new TargetRule
                {
                    Id = "rule1",
                    Conditions =
                    [
                        new Condition { Property = "country", Op = "Equal", Value = "US" }
                    ],
                    Variations =
                    [
                        new RolloutVariation { Id = "var1", Rollout = [0, 0.5] },
                        new RolloutVariation { Id = "var2", Rollout = [0.5, 1] }
                    ]
                }
            ]
        );

        var targetFlag = CreateFeatureFlag(
            variations:
            [
                new Variation { Id = "var3", Name = "Variation 1", Value = "true" },
                new Variation { Id = "var4", Name = "Variation 2", Value = "false" }
            ],
            rules:
            [
                new TargetRule
                {
                    Id = "rule2",
                    Conditions =
                    [
                        new Condition { Property = "country", Op = "Equal", Value = "US" }
                    ],
                    Variations =
                    [
                        new RolloutVariation { Id = "var3", Rollout = [0, 0.7] }, // Different rollout
                        new RolloutVariation { Id = "var4", Rollout = [0.7, 1] }
                    ]
                }
            ]
        );

        var diffs = FlagDiffer.CompareRules(sourceFlag, targetFlag, []);

        Assert.Single(diffs);
        Assert.True(diffs[0].IsDifferent);
    }

    [Fact]
    public void MultipleRulesAllSame()
    {
        var sourceFlag = CreateFeatureFlag(
            variations:
            [
                new Variation { Id = "var1", Name = "Variation 1", Value = "true" },
                new Variation { Id = "var2", Name = "Variation 2", Value = "false" }
            ],
            rules:
            [
                new TargetRule
                {
                    Conditions =
                    [
                        new Condition { Property = "country", Op = "Equal", Value = "US" }
                    ],
                    Variations =
                    [
                        new RolloutVariation { Id = "var1", Rollout = [0, 1] }
                    ]
                },
                new TargetRule
                {
                    Conditions =
                    [
                        new Condition { Property = "age", Op = "BiggerThan", Value = "18" }
                    ],
                    Variations =
                    [
                        new RolloutVariation { Id = "var2", Rollout = [0, 1] }
                    ]
                }
            ]
        );

        var targetFlag = CreateFeatureFlag(
            variations:
            [
                new Variation { Id = "var3", Name = "Variation 1", Value = "true" },
                new Variation { Id = "var4", Name = "Variation 2", Value = "false" }
            ],
            rules:
            [
                new TargetRule
                {
                    Conditions =
                    [
                        new Condition { Property = "country", Op = "Equal", Value = "US" }
                    ],
                    Variations =
                    [
                        new RolloutVariation { Id = "var3", Rollout = [0, 1] }
                    ]
                },
                new TargetRule
                {
                    Conditions =
                    [
                        new Condition { Property = "age", Op = "BiggerThan", Value = "18" }
                    ],
                    Variations =
                    [
                        new RolloutVariation { Id = "var4", Rollout = [0, 1] }
                    ]
                }
            ]
        );

        var diffs = FlagDiffer.CompareRules(sourceFlag, targetFlag, []);

        Assert.Equal(2, diffs.Count);
        Assert.All(diffs, diff => Assert.False(diff.IsDifferent));
    }

    [Fact]
    public void MultipleRulesWithSomeDifferent()
    {
        var sourceFlag = CreateFeatureFlag(
            variations:
            [
                new Variation { Id = "var1", Name = "Variation 1", Value = "true" },
                new Variation { Id = "var2", Name = "Variation 2", Value = "false" }
            ],
            rules:
            [
                new TargetRule
                {
                    Conditions =
                    [
                        new Condition { Property = "country", Op = "Equal", Value = "US" }
                    ],
                    Variations =
                    [
                        new RolloutVariation { Id = "var1", Rollout = [0, 1] }
                    ]
                },
                new TargetRule
                {
                    Conditions =
                    [
                        new Condition { Property = "age", Op = "BiggerThan", Value = "18" }
                    ],
                    Variations =
                    [
                        new RolloutVariation { Id = "var2", Rollout = [0, 1] }
                    ]
                }
            ]
        );

        var targetFlag = CreateFeatureFlag(
            variations:
            [
                new Variation { Id = "var3", Name = "Variation 1", Value = "true" },
                new Variation { Id = "var4", Name = "Variation 2", Value = "false" }
            ],
            rules:
            [
                new TargetRule
                {
                    Conditions =
                    [
                        new Condition { Property = "country", Op = "Equal", Value = "CA" } // Different condition
                    ],
                    Variations =
                    [
                        new RolloutVariation { Id = "var3", Rollout = [0, 1] }
                    ]
                },
                new TargetRule
                {
                    Conditions =
                    [
                        new Condition { Property = "age", Op = "BiggerThan", Value = "18" }
                    ],
                    Variations =
                    [
                        new RolloutVariation { Id = "var4", Rollout = [0, 1] }
                    ]
                }
            ]
        );

        var diffs = FlagDiffer.CompareRules(sourceFlag, targetFlag, []);

        Assert.Equal(2, diffs.Count);
        Assert.True(diffs[0].IsDifferent);
        Assert.False(diffs[1].IsDifferent);
    }

    [Fact]
    public void RuleWithMultipleConditions()
    {
        var sourceFlag = CreateFeatureFlag(
            variations:
            [
                new Variation { Id = "var1", Name = "Variation 1", Value = "true" }
            ],
            rules:
            [
                new TargetRule
                {
                    Conditions =
                    [
                        new Condition { Property = "country", Op = "Equal", Value = "US" },
                        new Condition { Property = "age", Op = "BiggerThan", Value = "18" }
                    ],
                    Variations =
                    [
                        new RolloutVariation { Id = "var1", Rollout = [0, 1] }
                    ]
                }
            ]
        );

        var targetFlag = CreateFeatureFlag(
            variations:
            [
                new Variation { Id = "var2", Name = "Variation 1", Value = "true" }
            ],
            rules:
            [
                new TargetRule
                {
                    Conditions =
                    [
                        new Condition { Property = "country", Op = "Equal", Value = "US" },
                        new Condition { Property = "age", Op = "BiggerThan", Value = "18" }
                    ],
                    Variations =
                    [
                        new RolloutVariation { Id = "var2", Rollout = [0, 1] }
                    ]
                }
            ]
        );

        var diffs = FlagDiffer.CompareRules(sourceFlag, targetFlag, []);

        Assert.Single(diffs);
        Assert.False(diffs[0].IsDifferent);
    }

    [Fact]
    public void RuleWithDifferentNumberOfConditions()
    {
        var sourceFlag = CreateFeatureFlag(
            variations:
            [
                new Variation { Id = "var1", Name = "Variation 1", Value = "true" }
            ],
            rules:
            [
                new TargetRule
                {
                    Conditions =
                    [
                        new Condition { Property = "country", Op = "Equal", Value = "US" }
                    ],
                    Variations =
                    [
                        new RolloutVariation { Id = "var1", Rollout = [0, 1] }
                    ]
                }
            ]
        );

        var targetFlag = CreateFeatureFlag(
            variations:
            [
                new Variation { Id = "var2", Name = "Variation 1", Value = "true" }
            ],
            rules:
            [
                new TargetRule
                {
                    Conditions =
                    [
                        new Condition { Property = "country", Op = "Equal", Value = "US" },
                        new Condition { Property = "age", Op = "BiggerThan", Value = "18" } // Additional condition
                    ],
                    Variations =
                    [
                        new RolloutVariation { Id = "var2", Rollout = [0, 1] }
                    ]
                }
            ]
        );

        var diffs = FlagDiffer.CompareRules(sourceFlag, targetFlag, []);

        Assert.Equal(2, diffs.Count);
        Assert.All(diffs, diff => Assert.True(diff.IsDifferent));
    }

    [Fact]
    public void RuleConditionsOrderDoesNotMatter()
    {
        var sourceFlag = CreateFeatureFlag(
            variations:
            [
                new Variation { Id = "var1", Name = "Variation 1", Value = "true" }
            ],
            rules:
            [
                new TargetRule
                {
                    Id = "rule1",
                    Conditions =
                    [
                        new Condition { Property = "country", Op = "Equal", Value = "US" },
                        new Condition { Property = "age", Op = "BiggerThan", Value = "18" }
                    ],
                    Variations =
                    [
                        new RolloutVariation { Id = "var1", Rollout = [0, 1] }
                    ]
                }
            ]
        );

        var targetFlag = CreateFeatureFlag(
            variations:
            [
                new Variation { Id = "var2", Name = "Variation 1", Value = "true" }
            ],
            rules:
            [
                new TargetRule
                {
                    Id = "rule2",
                    Conditions =
                    [
                        new Condition { Property = "age", Op = "BiggerThan", Value = "18" }, // Different order
                        new Condition { Property = "country", Op = "Equal", Value = "US" }
                    ],
                    Variations =
                    [
                        new RolloutVariation { Id = "var2", Rollout = [0, 1] }
                    ]
                }
            ]
        );

        var diffs = FlagDiffer.CompareRules(sourceFlag, targetFlag, []);

        Assert.Single(diffs);
        Assert.False(diffs[0].IsDifferent);
    }

    [Fact]
    public void RuleAdded()
    {
        var sourceFlag = CreateFeatureFlag(
            variations:
            [
                new Variation { Id = "var1", Name = "Variation 1", Value = "true" }
            ],
            rules: [] // No rules in source
        );

        var targetFlag = CreateFeatureFlag(
            variations:
            [
                new Variation { Id = "var2", Name = "Variation 1", Value = "true" }
            ],
            rules:
            [
                new TargetRule
                {
                    Id = "rule1",
                    Conditions =
                    [
                        new Condition { Property = "country", Op = "Equal", Value = "US" }
                    ],
                    Variations =
                    [
                        new RolloutVariation { Id = "var2", Rollout = [0, 1] }
                    ]
                }
            ]
        );

        var diffs = FlagDiffer.CompareRules(sourceFlag, targetFlag, []);

        Assert.Single(diffs);
        Assert.True(diffs[0].IsDifferent);
        Assert.Null(diffs[0].Source);
        Assert.NotNull(diffs[0].Target);
    }

    [Fact]
    public void DifferentConditionProperty()
    {
        var sourceFlag = CreateFeatureFlag(
            variations:
            [
                new Variation { Id = "var1", Name = "Variation 1", Value = "true" }
            ],
            rules:
            [
                new TargetRule
                {
                    Conditions =
                    [
                        new Condition { Property = "country", Op = "Equal", Value = "US" }
                    ],
                    Variations =
                    [
                        new RolloutVariation { Id = "var1", Rollout = [0, 1] }
                    ]
                }
            ]
        );

        var targetFlag = CreateFeatureFlag(
            variations:
            [
                new Variation { Id = "var2", Name = "Variation 1", Value = "true" }
            ],
            rules:
            [
                new TargetRule
                {
                    Conditions =
                    [
                        new Condition { Property = "region", Op = "Equal", Value = "US" } // Different property
                    ],
                    Variations =
                    [
                        new RolloutVariation { Id = "var2", Rollout = [0, 1] }
                    ]
                }
            ]
        );

        var diffs = FlagDiffer.CompareRules(sourceFlag, targetFlag, []);

        Assert.Equal(2, diffs.Count);
        Assert.All(diffs, diff => Assert.True(diff.IsDifferent));
    }

    [Fact]
    public void DifferentConditionOperator()
    {
        var sourceFlag = CreateFeatureFlag(
            variations:
            [
                new Variation { Id = "var1", Name = "Variation 1", Value = "true" }
            ],
            rules:
            [
                new TargetRule
                {
                    Conditions =
                    [
                        new Condition { Property = "country", Op = "Equal", Value = "US" }
                    ],
                    Variations =
                    [
                        new RolloutVariation { Id = "var1", Rollout = [0, 1] }
                    ]
                }
            ]
        );

        var targetFlag = CreateFeatureFlag(
            variations:
            [
                new Variation { Id = "var2", Name = "Variation 1", Value = "true" }
            ],
            rules:
            [
                new TargetRule
                {
                    Conditions =
                    [
                        new Condition { Property = "country", Op = "NotEqual", Value = "US" } // Different operator
                    ],
                    Variations =
                    [
                        new RolloutVariation { Id = "var2", Rollout = [0, 1] }
                    ]
                }
            ]
        );

        var diffs = FlagDiffer.CompareRules(sourceFlag, targetFlag, []);

        Assert.Equal(2, diffs.Count);
        Assert.All(diffs, diff => Assert.True(diff.IsDifferent));
    }

    [Fact]
    public void CompletelyDifferentRuleSets()
    {
        var sourceFlag = CreateFeatureFlag(
            variations:
            [
                new Variation { Id = "var1", Name = "Variation 1", Value = "true" },
                new Variation { Id = "var2", Name = "Variation 2", Value = "false" }
            ],
            rules:
            [
                new TargetRule
                {
                    Id = "rule1",
                    Conditions =
                    [
                        new Condition { Property = "country", Op = "Equal", Value = "US" }
                    ],
                    Variations =
                    [
                        new RolloutVariation { Id = "var1", Rollout = [0, 1] }
                    ]
                },
                new TargetRule
                {
                    Id = "rule2",
                    Conditions =
                    [
                        new Condition { Property = "age", Op = "BiggerThan", Value = "18" }
                    ],
                    Variations =
                    [
                        new RolloutVariation { Id = "var2", Rollout = [0, 1] }
                    ]
                }
            ]
        );

        var targetFlag = CreateFeatureFlag(
            variations:
            [
                new Variation { Id = "var3", Name = "Variation 1", Value = "true" },
                new Variation { Id = "var4", Name = "Variation 2", Value = "false" }
            ],
            rules:
            [
                new TargetRule
                {
                    Id = "rule3",
                    Conditions =
                    [
                        new Condition { Property = "city", Op = "Equal", Value = "NYC" }
                    ],
                    Variations =
                    [
                        new RolloutVariation { Id = "var3", Rollout = [0, 1] }
                    ]
                },
                new TargetRule
                {
                    Id = "rule4",
                    Conditions =
                    [
                        new Condition { Property = "state", Op = "Equal", Value = "NY" }
                    ],
                    Variations =
                    [
                        new RolloutVariation { Id = "var4", Rollout = [0, 1] }
                    ]
                }
            ]
        );

        var diffs = FlagDiffer.CompareRules(sourceFlag, targetFlag, []);

        Assert.Equal(4, diffs.Count);
        Assert.All(diffs, diff => Assert.True(diff.IsDifferent));
    }

    [Fact]
    public void RuleWithMissingOneCondition()
    {
        var sourceFlag = CreateFeatureFlag(
            variations:
            [
                new Variation { Id = "var1", Name = "Variation 1", Value = "true" }
            ],
            rules:
            [
                new TargetRule
                {
                    Conditions =
                    [
                        new Condition { Property = "country", Op = "Equal", Value = "US" },
                        new Condition { Property = "age", Op = "BiggerThan", Value = "18" },
                        new Condition { Property = "state", Op = "Equal", Value = "CA" }
                    ],
                    Variations =
                    [
                        new RolloutVariation { Id = "var1", Rollout = [0, 1] }
                    ]
                }
            ]
        );

        var targetFlag = CreateFeatureFlag(
            variations:
            [
                new Variation { Id = "var2", Name = "Variation 1", Value = "true" }
            ],
            rules:
            [
                new TargetRule
                {
                    Conditions =
                    [
                        new Condition { Property = "country", Op = "Equal", Value = "US" },
                        new Condition { Property = "age", Op = "BiggerThan", Value = "18" }
                        // Missing state condition
                    ],
                    Variations =
                    [
                        new RolloutVariation { Id = "var2", Rollout = [0, 1] }
                    ]
                }
            ]
        );

        var diffs = FlagDiffer.CompareRules(sourceFlag, targetFlag, []);

        Assert.Equal(2, diffs.Count);
        Assert.All(diffs, diff => Assert.True(diff.IsDifferent));
    }

    [Fact]
    public void VerifySourceAndTargetDiffProperties()
    {
        var sourceFlag = CreateFeatureFlag(
            variations:
            [
                new Variation { Id = "var1", Name = "Variation 1", Value = "true" }
            ],
            rules:
            [
                new TargetRule
                {
                    Id = "rule1",
                    Conditions =
                    [
                        new Condition { Property = "country", Op = "Equal", Value = "US" }
                    ],
                    Variations =
                    [
                        new RolloutVariation { Id = "var1", Rollout = [0, 1] }
                    ]
                }
            ]
        );

        var targetFlag = CreateFeatureFlag(
            variations:
            [
                new Variation { Id = "var2", Name = "Variation 1", Value = "true" }
            ],
            rules:
            [
                new TargetRule
                {
                    Id = "rule2",
                    Conditions =
                    [
                        new Condition { Property = "country", Op = "Equal", Value = "CA" }
                    ],
                    Variations =
                    [
                        new RolloutVariation { Id = "var2", Rollout = [0, 1] }
                    ]
                }
            ]
        );

        var diffs = FlagDiffer.CompareRules(sourceFlag, targetFlag, []);

        Assert.Equal(2, diffs.Count);
        
        // First diff: source rule not found in target
        Assert.NotNull(diffs[0].Source);
        Assert.Equal("rule1", diffs[0].Source.Id);
        Assert.Null(diffs[0].Target);
        Assert.True(diffs[0].IsDifferent);

        // Second diff: target rule not found in source
        Assert.Null(diffs[1].Source);
        Assert.NotNull(diffs[1].Target);
        Assert.Equal("rule2", diffs[1].Target.Id);
        Assert.True(diffs[1].IsDifferent);
    }

    [Fact]
    public void SegmentCondition_SameSegmentNames()
    {
        var segment1 = CreateSegment(Guid.NewGuid(), "Premium Users");
        var segment2 = CreateSegment(Guid.NewGuid(), "Premium Users"); // Different ID, same name

        var sourceFlag = CreateFeatureFlag(
            variations:
            [
                new Variation { Id = "var1", Name = "Variation 1", Value = "true" }
            ],
            rules:
            [
                new TargetRule
                {
                    Conditions =
                    [
                        new Condition
                        {
                            Property = SegmentConsts.IsInSegment,
                            Op = "Equal",
                            Value = $"[\"{segment1.Id}\"]"
                        }
                    ],
                    Variations =
                    [
                        new RolloutVariation { Id = "var1", Rollout = [0, 1] }
                    ]
                }
            ]
        );

        var targetFlag = CreateFeatureFlag(
            variations:
            [
                new Variation { Id = "var2", Name = "Variation 1", Value = "true" }
            ],
            rules:
            [
                new TargetRule
                {
                    Conditions =
                    [
                        new Condition
                        {
                            Property = SegmentConsts.IsInSegment,
                            Op = "Equal",
                            Value = $"[\"{segment2.Id}\"]" // Different ID but same name
                        }
                    ],
                    Variations =
                    [
                        new RolloutVariation { Id = "var2", Rollout = [0, 1] }
                    ]
                }
            ]
        );

        var diffs = FlagDiffer.CompareRules(sourceFlag, targetFlag, [segment1, segment2]);

        Assert.Single(diffs);
        Assert.False(diffs[0].IsDifferent);
    }

    [Fact]
    public void SegmentCondition_DifferentSegmentNames()
    {
        var segment1 = CreateSegment(Guid.NewGuid(), "Premium Users");
        var segment2 = CreateSegment(Guid.NewGuid(), "Basic Users");

        var sourceFlag = CreateFeatureFlag(
            variations:
            [
                new Variation { Id = "var1", Name = "Variation 1", Value = "true" }
            ],
            rules:
            [
                new TargetRule
                {
                    Conditions =
                    [
                        new Condition
                        {
                            Property = SegmentConsts.IsInSegment,
                            Op = "Equal",
                            Value = $"[\"{segment1.Id}\"]"
                        }
                    ],
                    Variations =
                    [
                        new RolloutVariation { Id = "var1", Rollout = [0, 1] }
                    ]
                }
            ]
        );

        var targetFlag = CreateFeatureFlag(
            variations:
            [
                new Variation { Id = "var2", Name = "Variation 1", Value = "true" }
            ],
            rules:
            [
                new TargetRule
                {
                    Conditions =
                    [
                        new Condition
                        {
                            Property = SegmentConsts.IsInSegment,
                            Op = "Equal",
                            Value = $"[\"{segment2.Id}\"]"
                        }
                    ],
                    Variations =
                    [
                        new RolloutVariation { Id = "var2", Rollout = [0, 1] }
                    ]
                }
            ]
        );

        var diffs = FlagDiffer.CompareRules(sourceFlag, targetFlag, [segment1, segment2]);

        Assert.Equal(2, diffs.Count);
        Assert.All(diffs, diff => Assert.True(diff.IsDifferent));
    }

    [Fact]
    public void SegmentCondition_MultipleSegments_SameNames()
    {
        var segment1 = CreateSegment(Guid.NewGuid(), "Premium Users");
        var segment2 = CreateSegment(Guid.NewGuid(), "VIP Users");
        var segment3 = CreateSegment(Guid.NewGuid(), "Premium Users"); // Different ID, same name as segment1
        var segment4 = CreateSegment(Guid.NewGuid(), "VIP Users"); // Different ID, same name as segment2

        var sourceFlag = CreateFeatureFlag(
            variations:
            [
                new Variation { Id = "var1", Name = "Variation 1", Value = "true" }
            ],
            rules:
            [
                new TargetRule
                {
                    Conditions =
                    [
                        new Condition
                        {
                            Property = SegmentConsts.IsInSegment,
                            Op = "Equal",
                            Value = $"[\"{segment1.Id}\",\"{segment2.Id}\"]"
                        }
                    ],
                    Variations =
                    [
                        new RolloutVariation { Id = "var1", Rollout = [0, 1] }
                    ]
                }
            ]
        );

        var targetFlag = CreateFeatureFlag(
            variations:
            [
                new Variation { Id = "var2", Name = "Variation 1", Value = "true" }
            ],
            rules:
            [
                new TargetRule
                {
                    Conditions =
                    [
                        new Condition
                        {
                            Property = SegmentConsts.IsInSegment,
                            Op = "Equal",
                            Value = $"[\"{segment4.Id}\",\"{segment3.Id}\"]" // Different order, different IDs
                        }
                    ],
                    Variations =
                    [
                        new RolloutVariation { Id = "var2", Rollout = [0, 1] }
                    ]
                }
            ]
        );

        var diffs = FlagDiffer.CompareRules(sourceFlag, targetFlag, [segment1, segment2, segment3, segment4]);

        Assert.Single(diffs);
        Assert.False(diffs[0].IsDifferent);
    }

    [Fact]
    public void SegmentCondition_IsNotInSegment_SameNames()
    {
        var segment1 = CreateSegment(Guid.NewGuid(), "Blocked Users");
        var segment2 = CreateSegment(Guid.NewGuid(), "Blocked Users");

        var sourceFlag = CreateFeatureFlag(
            variations:
            [
                new Variation { Id = "var1", Name = "Variation 1", Value = "true" }
            ],
            rules:
            [
                new TargetRule
                {
                    Conditions =
                    [
                        new Condition
                        {
                            Property = SegmentConsts.IsNotInSegment,
                            Op = "Equal",
                            Value = $"[\"{segment1.Id}\"]"
                        }
                    ],
                    Variations =
                    [
                        new RolloutVariation { Id = "var1", Rollout = [0, 1] }
                    ]
                }
            ]
        );

        var targetFlag = CreateFeatureFlag(
            variations:
            [
                new Variation { Id = "var2", Name = "Variation 1", Value = "true" }
            ],
            rules:
            [
                new TargetRule
                {
                    Conditions =
                    [
                        new Condition
                        {
                            Property = SegmentConsts.IsNotInSegment,
                            Op = "Equal",
                            Value = $"[\"{segment2.Id}\"]"
                        }
                    ],
                    Variations =
                    [
                        new RolloutVariation { Id = "var2", Rollout = [0, 1] }
                    ]
                }
            ]
        );

        var diffs = FlagDiffer.CompareRules(sourceFlag, targetFlag, [segment1, segment2]);

        Assert.Single(diffs);
        Assert.False(diffs[0].IsDifferent);
    }

    [Fact]
    public void MultiValueCondition_IsOneOf_SameValues()
    {
        var sourceFlag = CreateFeatureFlag(
            variations:
            [
                new Variation { Id = "var1", Name = "Variation 1", Value = "true" }
            ],
            rules:
            [
                new TargetRule
                {
                    Conditions =
                    [
                        new Condition
                        {
                            Property = "country",
                            Op = OperatorTypes.IsOneOf,
                            Value = "[\"US\",\"CA\",\"UK\"]"
                        }
                    ],
                    Variations =
                    [
                        new RolloutVariation { Id = "var1", Rollout = [0, 1] }
                    ]
                }
            ]
        );

        var targetFlag = CreateFeatureFlag(
            variations:
            [
                new Variation { Id = "var2", Name = "Variation 1", Value = "true" }
            ],
            rules:
            [
                new TargetRule
                {
                    Conditions =
                    [
                        new Condition
                        {
                            Property = "country",
                            Op = OperatorTypes.IsOneOf,
                            Value = "[\"US\",\"CA\",\"UK\"]"
                        }
                    ],
                    Variations =
                    [
                        new RolloutVariation { Id = "var2", Rollout = [0, 1] }
                    ]
                }
            ]
        );

        var diffs = FlagDiffer.CompareRules(sourceFlag, targetFlag, []);

        Assert.Single(diffs);
        Assert.False(diffs[0].IsDifferent);
    }

    [Fact]
    public void MultiValueCondition_IsOneOf_DifferentOrder()
    {
        var sourceFlag = CreateFeatureFlag(
            variations:
            [
                new Variation { Id = "var1", Name = "Variation 1", Value = "true" }
            ],
            rules:
            [
                new TargetRule
                {
                    Conditions =
                    [
                        new Condition
                        {
                            Property = "country",
                            Op = OperatorTypes.IsOneOf,
                            Value = "[\"US\",\"CA\",\"UK\"]"
                        }
                    ],
                    Variations =
                    [
                        new RolloutVariation { Id = "var1", Rollout = [0, 1] }
                    ]
                }
            ]
        );

        var targetFlag = CreateFeatureFlag(
            variations:
            [
                new Variation { Id = "var2", Name = "Variation 1", Value = "true" }
            ],
            rules:
            [
                new TargetRule
                {
                    Conditions =
                    [
                        new Condition
                        {
                            Property = "country",
                            Op = OperatorTypes.IsOneOf,
                            Value = "[\"UK\",\"US\",\"CA\"]" // Different order
                        }
                    ],
                    Variations =
                    [
                        new RolloutVariation { Id = "var2", Rollout = [0, 1] }
                    ]
                }
            ]
        );

        var diffs = FlagDiffer.CompareRules(sourceFlag, targetFlag, []);

        Assert.Single(diffs);
        Assert.False(diffs[0].IsDifferent);
    }

    [Fact]
    public void MultiValueCondition_IsOneOf_DifferentValues()
    {
        var sourceFlag = CreateFeatureFlag(
            variations:
            [
                new Variation { Id = "var1", Name = "Variation 1", Value = "true" }
            ],
            rules:
            [
                new TargetRule
                {
                    Conditions =
                    [
                        new Condition
                        {
                            Property = "country",
                            Op = OperatorTypes.IsOneOf,
                            Value = "[\"US\",\"CA\"]"
                        }
                    ],
                    Variations =
                    [
                        new RolloutVariation { Id = "var1", Rollout = [0, 1] }
                    ]
                }
            ]
        );

        var targetFlag = CreateFeatureFlag(
            variations:
            [
                new Variation { Id = "var2", Name = "Variation 1", Value = "true" }
            ],
            rules:
            [
                new TargetRule
                {
                    Conditions =
                    [
                        new Condition
                        {
                            Property = "country",
                            Op = OperatorTypes.IsOneOf,
                            Value = "[\"US\",\"UK\"]" // Different value
                        }
                    ],
                    Variations =
                    [
                        new RolloutVariation { Id = "var2", Rollout = [0, 1] }
                    ]
                }
            ]
        );

        var diffs = FlagDiffer.CompareRules(sourceFlag, targetFlag, []);

        Assert.Equal(2, diffs.Count);
        Assert.All(diffs, diff => Assert.True(diff.IsDifferent));
    }

    [Fact]
    public void MultiValueCondition_NotOneOf_SameValues()
    {
        var sourceFlag = CreateFeatureFlag(
            variations:
            [
                new Variation { Id = "var1", Name = "Variation 1", Value = "true" }
            ],
            rules:
            [
                new TargetRule
                {
                    Conditions =
                    [
                        new Condition
                        {
                            Property = "country",
                            Op = OperatorTypes.NotOneOf,
                            Value = "[\"CN\",\"RU\"]"
                        }
                    ],
                    Variations =
                    [
                        new RolloutVariation { Id = "var1", Rollout = [0, 1] }
                    ]
                }
            ]
        );

        var targetFlag = CreateFeatureFlag(
            variations:
            [
                new Variation { Id = "var2", Name = "Variation 1", Value = "true" }
            ],
            rules:
            [
                new TargetRule
                {
                    Conditions =
                    [
                        new Condition
                        {
                            Property = "country",
                            Op = OperatorTypes.NotOneOf,
                            Value = "[\"RU\",\"CN\"]" // Different order
                        }
                    ],
                    Variations =
                    [
                        new RolloutVariation { Id = "var2", Rollout = [0, 1] }
                    ]
                }
            ]
        );

        var diffs = FlagDiffer.CompareRules(sourceFlag, targetFlag, []);

        Assert.Single(diffs);
        Assert.False(diffs[0].IsDifferent);
    }

    [Fact]
    public void MixedConditions_SegmentAndMultiValue_SameValues()
    {
        var segment1 = CreateSegment(Guid.NewGuid(), "Premium Users");
        var segment2 = CreateSegment(Guid.NewGuid(), "Premium Users");

        var sourceFlag = CreateFeatureFlag(
            variations:
            [
                new Variation { Id = "var1", Name = "Variation 1", Value = "true" }
            ],
            rules:
            [
                new TargetRule
                {
                    Conditions =
                    [
                        new Condition
                        {
                            Property = SegmentConsts.IsInSegment,
                            Op = "Equal",
                            Value = $"[\"{segment1.Id}\"]"
                        },
                        new Condition
                        {
                            Property = "country",
                            Op = OperatorTypes.IsOneOf,
                            Value = "[\"US\",\"CA\"]"
                        }
                    ],
                    Variations =
                    [
                        new RolloutVariation { Id = "var1", Rollout = [0, 1] }
                    ]
                }
            ]
        );

        var targetFlag = CreateFeatureFlag(
            variations:
            [
                new Variation { Id = "var2", Name = "Variation 1", Value = "true" }
            ],
            rules:
            [
                new TargetRule
                {
                    Conditions =
                    [
                        new Condition
                        {
                            Property = "country",
                            Op = OperatorTypes.IsOneOf,
                            Value = "[\"CA\",\"US\"]" // Different order
                        },
                        new Condition
                        {
                            Property = SegmentConsts.IsInSegment,
                            Op = "Equal",
                            Value = $"[\"{segment2.Id}\"]" // Different ID, same name
                        }
                    ],
                    Variations =
                    [
                        new RolloutVariation { Id = "var2", Rollout = [0, 1] }
                    ]
                }
            ]
        );

        var diffs = FlagDiffer.CompareRules(sourceFlag, targetFlag, [segment1, segment2]);

        Assert.Single(diffs);
        Assert.False(diffs[0].IsDifferent);
    }

    [Fact]
    public void MixedConditions_SegmentAndSingleValue_SameValues()
    {
        var segment1 = CreateSegment(Guid.NewGuid(), "Beta Testers");
        var segment2 = CreateSegment(Guid.NewGuid(), "Beta Testers");

        var sourceFlag = CreateFeatureFlag(
            variations:
            [
                new Variation { Id = "var1", Name = "Variation 1", Value = "true" }
            ],
            rules:
            [
                new TargetRule
                {
                    Conditions =
                    [
                        new Condition
                        {
                            Property = SegmentConsts.IsInSegment,
                            Op = "Equal",
                            Value = $"[\"{segment1.Id}\"]"
                        },
                        new Condition
                        {
                            Property = "country",
                            Op = OperatorTypes.Equal,
                            Value = "US"
                        }
                    ],
                    Variations =
                    [
                        new RolloutVariation { Id = "var1", Rollout = [0, 1] }
                    ]
                }
            ]
        );

        var targetFlag = CreateFeatureFlag(
            variations:
            [
                new Variation { Id = "var2", Name = "Variation 1", Value = "true" }
            ],
            rules:
            [
                new TargetRule
                {
                    Conditions =
                    [
                        new Condition
                        {
                            Property = "country",
                            Op = OperatorTypes.Equal,
                            Value = "US"
                        },
                        new Condition
                        {
                            Property = SegmentConsts.IsInSegment,
                            Op = "Equal",
                            Value = $"[\"{segment2.Id}\"]"
                        }
                    ],
                    Variations =
                    [
                        new RolloutVariation { Id = "var2", Rollout = [0, 1] }
                    ]
                }
            ]
        );

        var diffs = FlagDiffer.CompareRules(sourceFlag, targetFlag, [segment1, segment2]);

        Assert.Single(diffs);
        Assert.False(diffs[0].IsDifferent);
    }

    [Fact]
    public void SingleValueCondition_DifferentOperators_SameProperty()
    {
        var sourceFlag = CreateFeatureFlag(
            variations:
            [
                new Variation { Id = "var1", Name = "Variation 1", Value = "true" }
            ],
            rules:
            [
                new TargetRule
                {
                    Conditions =
                    [
                        new Condition
                        {
                            Property = "age",
                            Op = OperatorTypes.BiggerThan,
                            Value = "18"
                        }
                    ],
                    Variations =
                    [
                        new RolloutVariation { Id = "var1", Rollout = [0, 1] }
                    ]
                }
            ]
        );

        var targetFlag = CreateFeatureFlag(
            variations:
            [
                new Variation { Id = "var2", Name = "Variation 1", Value = "true" }
            ],
            rules:
            [
                new TargetRule
                {
                    Conditions =
                    [
                        new Condition
                        {
                            Property = "age",
                            Op = OperatorTypes.BiggerEqualThan, // Different operator
                            Value = "18"
                        }
                    ],
                    Variations =
                    [
                        new RolloutVariation { Id = "var2", Rollout = [0, 1] }
                    ]
                }
            ]
        );

        var diffs = FlagDiffer.CompareRules(sourceFlag, targetFlag, []);

        Assert.Equal(2, diffs.Count);
        Assert.All(diffs, diff => Assert.True(diff.IsDifferent));
    }

    [Fact]
    public void SingleValueCondition_StringOperators_SameValues()
    {
        var sourceFlag = CreateFeatureFlag(
            variations:
            [
                new Variation { Id = "var1", Name = "Variation 1", Value = "true" }
            ],
            rules:
            [
                new TargetRule
                {
                    Conditions =
                    [
                        new Condition
                        {
                            Property = "email",
                            Op = OperatorTypes.EndsWith,
                            Value = "@company.com"
                        }
                    ],
                    Variations =
                    [
                        new RolloutVariation { Id = "var1", Rollout = [0, 1] }
                    ]
                }
            ]
        );

        var targetFlag = CreateFeatureFlag(
            variations:
            [
                new Variation { Id = "var2", Name = "Variation 1", Value = "true" }
            ],
            rules:
            [
                new TargetRule
                {
                    Conditions =
                    [
                        new Condition
                        {
                            Property = "email",
                            Op = OperatorTypes.EndsWith,
                            Value = "@company.com"
                        }
                    ],
                    Variations =
                    [
                        new RolloutVariation { Id = "var2", Rollout = [0, 1] }
                    ]
                }
            ]
        );

        var diffs = FlagDiffer.CompareRules(sourceFlag, targetFlag, []);

        Assert.Single(diffs);
        Assert.False(diffs[0].IsDifferent);
    }

    [Fact]
    public void ComplexRule_MultipleConditionTypes_AllMatch()
    {
        var segment1 = CreateSegment(Guid.NewGuid(), "Enterprise Users");
        var segment2 = CreateSegment(Guid.NewGuid(), "Partner Users");
        var segment3 = CreateSegment(Guid.NewGuid(), "Enterprise Users");
        var segment4 = CreateSegment(Guid.NewGuid(), "Partner Users");

        var sourceFlag = CreateFeatureFlag(
            variations:
            [
                new Variation { Id = "var1", Name = "Variation 1", Value = "true" }
            ],
            rules:
            [
                new TargetRule
                {
                    Conditions =
                    [
                        new Condition
                        {
                            Property = SegmentConsts.IsInSegment,
                            Op = "Equal",
                            Value = $"[\"{segment1.Id}\",\"{segment2.Id}\"]"
                        },
                        new Condition
                        {
                            Property = "country",
                            Op = OperatorTypes.IsOneOf,
                            Value = "[\"US\",\"CA\",\"UK\"]"
                        },
                        new Condition
                        {
                            Property = "age",
                            Op = OperatorTypes.BiggerThan,
                            Value = "21"
                        },
                        new Condition
                        {
                            Property = "email",
                            Op = OperatorTypes.EndsWith,
                            Value = "@company.com"
                        }
                    ],
                    Variations =
                    [
                        new RolloutVariation { Id = "var1", Rollout = [0, 1] }
                    ]
                }
            ]
        );

        var targetFlag = CreateFeatureFlag(
            variations:
            [
                new Variation { Id = "var2", Name = "Variation 1", Value = "true" }
            ],
            rules:
            [
                new TargetRule
                {
                    Conditions =
                    [
                        new Condition
                        {
                            Property = "email",
                            Op = OperatorTypes.EndsWith,
                            Value = "@company.com"
                        },
                        new Condition
                        {
                            Property = "country",
                            Op = OperatorTypes.IsOneOf,
                            Value = "[\"UK\",\"US\",\"CA\"]" // Different order
                        },
                        new Condition
                        {
                            Property = SegmentConsts.IsInSegment,
                            Op = "Equal",
                            Value = $"[\"{segment4.Id}\",\"{segment3.Id}\"]" // Different IDs, different order
                        },
                        new Condition
                        {
                            Property = "age",
                            Op = OperatorTypes.BiggerThan,
                            Value = "21"
                        }
                    ],
                    Variations =
                    [
                        new RolloutVariation { Id = "var2", Rollout = [0, 1] }
                    ]
                }
            ]
        );

        var diffs = FlagDiffer.CompareRules(sourceFlag, targetFlag, [segment1, segment2, segment3, segment4]);

        Assert.Single(diffs);
        Assert.False(diffs[0].IsDifferent);
    }

    private static FeatureFlag CreateFeatureFlag(ICollection<Variation> variations, ICollection<TargetRule> rules)
    {
        return new FeatureFlag
        {
            Variations = variations,
            Rules = rules,
        };
    }

    private static Segment CreateSegment(Guid id, string name)
    {
        return new Segment(
            workspaceId: Guid.NewGuid(),
            envId: Guid.NewGuid(),
            name: name,
            key: "key",
            type: SegmentType.EnvironmentSpecific,
            scopes: [],
            included: [],
            excluded: [],
            rules: [],
            description: ""
        )
        {
            Id = id
        };
    }
}