using Domain.Segments;
using Domain.FeatureFlags;
using Domain.Targeting;

namespace Domain.UnitTests.Targeting;

public class RuleValidationTests
{
    private static Condition CommonCondition => new()
    {
        Property = "companyId",
        Op = OperatorTypes.IsOneOf,
        Value = "[\"company-1\"]"
    };

    private static Condition SegmentCondition => new()
    {
        Property = SegmentConsts.IsInSegment,
        Op = null,
        Value = "[\"segment-1\"]"
    };

    private static RolloutVariation FullRollout(string id = "variation-1") => new()
    {
        Id = id,
        Rollout = [0, 1]
    };

    private static Variation[] FlagVariations(params string[] ids) =>
        ids.Select(id => new Variation { Id = id }).ToArray();

    private static Fallthrough ValidFallthrough(string variationId = "variation-1") => new()
    {
        Variations = [FullRollout(variationId)]
    };

    [Fact]
    public void MatchRule_CommonCondition_IsValid()
    {
        var rule = new MatchRule { Conditions = [CommonCondition] };

        Assert.True(rule.IsValid());
    }

    [Fact]
    public void MatchRule_SegmentCondition_IsInvalid()
    {
        var rule = new MatchRule { Conditions = [SegmentCondition] };

        Assert.False(rule.IsValid());
    }

    [Fact]
    public void TargetRule_SegmentCondition_IsValid()
    {
        var rule = new TargetRule { Conditions = [SegmentCondition], Variations = [FullRollout()] };

        Assert.True(rule.IsValid(FlagVariations("variation-1")));
    }

    [Fact]
    public void TargetRule_InvalidCondition_IsInvalid()
    {
        var rule = new TargetRule
        {
            Conditions = [new Condition { Property = "companyId", Op = OperatorTypes.IsOneOf, Value = "[1]" }],
            Variations = [FullRollout()]
        };

        Assert.False(rule.IsValid(FlagVariations("variation-1", "variation-2")));
    }

    [Fact]
    public void TargetRule_VariationBelongsToFlagAndRolloutIsComplete_IsValid()
    {
        var rule = new TargetRule
        {
            Conditions = [CommonCondition],
            Variations =
            [
                new RolloutVariation { Id = "variation-1", Rollout = [0, 0.4] },
                new RolloutVariation { Id = "variation-2", Rollout = [0.4, 1] }
            ]
        };
        Variation[] flagVariations =
        [
            new() { Id = "variation-1" },
            new() { Id = "variation-2" }
        ];

        Assert.True(rule.IsValid(flagVariations));
    }

    [Fact]
    public void TargetRule_VariationDoesNotBelongToFlag_IsInvalid()
    {
        var rule = new TargetRule
        {
            Conditions = [CommonCondition],
            Variations = [FullRollout("unknown-variation")]
        };
        Variation[] flagVariations = [new() { Id = "variation-1" }];

        Assert.False(rule.IsValid(flagVariations));
    }

    [Fact]
    public void FlagTargeting_AllRulesAreValid_IsValid()
    {
        var targeting = new FlagTargeting
        {
            DisabledVariationId = "variation-1",
            Rules =
            [
                new TargetRule
                {
                    Conditions = [CommonCondition],
                    Variations = [FullRollout("variation-1")]
                }
            ],
            Fallthrough = ValidFallthrough()
        };

        Assert.True(targeting.IsValid(FlagVariations("variation-1")));
    }

    [Fact]
    public void FlagTargeting_ContainsInvalidRule_IsInvalid()
    {
        var targeting = new FlagTargeting
        {
            DisabledVariationId = "variation-1",
            Rules =
            [
                new TargetRule
                {
                    Conditions = [CommonCondition],
                    Variations = [FullRollout("unknown-variation")]
                }
            ],
            Fallthrough = ValidFallthrough()
        };

        Assert.False(targeting.IsValid(FlagVariations("variation-1")));
    }

    [Fact]
    public void FlagTargeting_InvalidFallthrough_IsInvalid()
    {
        var targeting = new FlagTargeting
        {
            DisabledVariationId = "variation-1",
            Rules = [],
            Fallthrough = new Fallthrough
            {
                Variations = [FullRollout("unknown-variation")]
            }
        };

        Assert.False(targeting.IsValid(FlagVariations("variation-1")));
    }

    [Fact]
    public void FlagTargeting_DisabledVariationDoesNotBelongToFlag_IsInvalid()
    {
        var targeting = new FlagTargeting
        {
            DisabledVariationId = "unknown-variation",
            Rules = [],
            Fallthrough = ValidFallthrough()
        };

        Assert.False(targeting.IsValid(FlagVariations("variation-1")));
    }
}
