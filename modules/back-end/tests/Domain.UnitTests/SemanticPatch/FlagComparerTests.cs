using System.Text.Json;
using Domain.FeatureFlags;
using Domain.SemanticPatch;
using Domain.Segments;
using Domain.Targeting;

namespace Domain.UnitTests.SemanticPatch;

public class FlagComparerTests
{
    private static Variation Var(string id, string name = "name", string value = "value") =>
        new() { Id = id, Name = name, Value = value };

    private static RolloutVariation Rollout(string id, double from = 0, double to = 1) =>
        new() { Id = id, Rollout = new[] { from, to } };

    [Fact]
    public void CompareStatus_NoChange_ReturnsNoop()
    {
        var result = FlagComparer.CompareStatus(true, true);

        Assert.IsType<NoopFlagInstruction>(result);
    }

    [Fact]
    public void CompareStatus_TurnedOn_ReturnsTurnFlagOn()
    {
        var result = FlagComparer.CompareStatus(false, true);

        Assert.IsType<StatusInstruction>(result);
        Assert.Equal(FlagInstructionKind.TurnFlagOn, result.Kind);
    }

    [Fact]
    public void CompareStatus_TurnedOff_ReturnsTurnFlagOff()
    {
        var result = FlagComparer.CompareStatus(true, false);

        Assert.Equal(FlagInstructionKind.TurnFlagOff, result.Kind);
    }

    [Theory]
    [InlineData(true, true, FlagInstructionKind.Noop)]
    [InlineData(false, false, FlagInstructionKind.Noop)]
    [InlineData(false, true, FlagInstructionKind.ArchiveFlag)]
    [InlineData(true, false, FlagInstructionKind.RestoreFlag)]
    public void CompareArchived_ReturnsExpectedKind(bool original, bool current, string expected)
    {
        var result = FlagComparer.CompareArchived(original, current);

        Assert.Equal(expected, result.Kind);
    }

    [Fact]
    public void CompareName_ChangedName_ReturnsNameInstruction()
    {
        var result = FlagComparer.CompareName("old", "new");

        var inst = Assert.IsType<NameInstruction>(result);
        Assert.Equal("new", inst.Value);
    }

    [Fact]
    public void CompareName_SameName_ReturnsNoop()
    {
        var result = FlagComparer.CompareName("same", "same");

        Assert.Same(NoopFlagInstruction.Instance, result);
    }

    [Fact]
    public void CompareDescription_ChangedDescription_ReturnsDescriptionInstruction()
    {
        var result = FlagComparer.CompareDescription("old", "new");

        var inst = Assert.IsType<DescriptionInstruction>(result);
        Assert.Equal("new", inst.Value);
    }

    [Fact]
    public void CompareTags_AddedAndRemoved_ProducesBothInstructions()
    {
        var original = new[] { "a", "b" };
        var current = new[] { "b", "c" };

        var result = FlagComparer.CompareTags(original, current).ToList();

        Assert.Equal(2, result.Count);
        var removed = result.Single(x => x.Kind == FlagInstructionKind.RemoveTags);
        var added = result.Single(x => x.Kind == FlagInstructionKind.AddTags);
        Assert.Equal(new[] { "a" }, (ICollection<string>)removed.Value);
        Assert.Equal(new[] { "c" }, (ICollection<string>)added.Value);
    }

    [Fact]
    public void CompareTags_NoChange_ReturnsEmpty()
    {
        var result = FlagComparer.CompareTags(new[] { "a" }, new[] { "a" });

        Assert.Empty(result);
    }

    [Fact]
    public void CompareVariationType_Changed_ReturnsVariationTypeInstruction()
    {
        var result = FlagComparer.CompareVariationType("string", "boolean");

        var inst = Assert.IsType<VariationTypeInstruction>(result);
        Assert.Equal("boolean", inst.Value);
    }

    [Fact]
    public void CompareVariations_AddRemoveAndUpdate_ProducesAllInstructions()
    {
        var original = new List<Variation> { Var("v1", "n1"), Var("v2", "old-name") };
        var current = new List<Variation> { Var("v2", "new-name"), Var("v3", "n3") };

        var result = FlagComparer.CompareVariations(original, current).ToList();

        Assert.Single(result.OfType<RemoveVariationInstruction>(), r => (string)r.Value == "v1");
        Assert.Single(result.OfType<AddVariationInstruction>(), a => ((Variation)a.Value).Id == "v3");
        var update = Assert.Single(result.OfType<UpdateVariationInstruction>());
        Assert.Equal("new-name", ((Variation)update.Value).Name);
    }

    [Fact]
    public void CompareDisabledVariation_Changed_ReturnsDisabledVariationInstruction()
    {
        var result = FlagComparer.CompareDisabledVariation("v1", "v2");

        var inst = Assert.IsType<DisabledVariationInstruction>(result);
        Assert.Equal("v2", inst.Value);
    }

    [Fact]
    public void CompareFallthrough_VariationsChanged_EmitsDefaultRuleUpdate()
    {
        var original = new Fallthrough { Variations = new List<RolloutVariation> { Rollout("v1") }, DispatchKey = "k" };
        var current = new Fallthrough { Variations = new List<RolloutVariation> { Rollout("v1"), Rollout("v2") }, DispatchKey = "k" };

        var result = FlagComparer.CompareFallthrough(original, current).ToList();

        Assert.Single(result);
        Assert.IsType<UpdateDefaultRuleVariationOrRolloutInstruction>(result[0]);
    }

    [Fact]
    public void CompareFallthrough_DispatchKeyChanged_EmitsDispatchKeyInstruction()
    {
        var rollout = new List<RolloutVariation> { Rollout("v1") };
        var original = new Fallthrough { Variations = rollout, DispatchKey = "k1" };
        var current = new Fallthrough { Variations = rollout, DispatchKey = "k2" };

        var result = FlagComparer.CompareFallthrough(original, current).ToList();

        Assert.Single(result);
        var inst = Assert.IsType<UpdateDefaultRuleDispatchKeyInstruction>(result[0]);
        Assert.Equal("k2", inst.Value);
    }

    [Fact]
    public void CompareRolloutVariations_DifferentCount_ReturnsTrue()
    {
        Assert.True(FlagComparer.CompareRolloutVariations(
            new[] { Rollout("v1") }, new[] { Rollout("v1"), Rollout("v2") }));
    }

    [Fact]
    public void CompareRolloutVariations_DifferentIds_ReturnsTrue()
    {
        Assert.True(FlagComparer.CompareRolloutVariations(
            new[] { Rollout("v1") }, new[] { Rollout("v2") }));
    }

    [Fact]
    public void CompareRolloutVariations_DifferentRolloutRanges_ReturnsTrue()
    {
        Assert.True(FlagComparer.CompareRolloutVariations(
            new[] { Rollout("v1", 0, 0.5) }, new[] { Rollout("v1", 0, 0.7) }));
    }

    [Fact]
    public void CompareRolloutVariations_Identical_ReturnsFalse()
    {
        Assert.False(FlagComparer.CompareRolloutVariations(
            new[] { Rollout("v1", 0, 1) }, new[] { Rollout("v1", 0, 1) }));
    }

    [Fact]
    public void CompareTargetUser_BothEmpty_ReturnsNoop()
    {
        var result = FlagComparer.CompareTargetUser("v1", null!, null!).ToList();

        Assert.IsType<NoopFlagInstruction>(result.Single());
    }

    [Fact]
    public void CompareTargetUser_OriginalEmpty_ReturnsSetInstruction()
    {
        var current = new TargetUser { VariationId = "v1", KeyIds = new[] { "k1" } };

        var result = FlagComparer.CompareTargetUser("v1", null!, current).ToList();

        var inst = Assert.IsType<TargetUsersInstruction>(result.Single());
        Assert.Equal(FlagInstructionKind.SetTargetUsers, inst.Kind);
        Assert.Equal(new[] { "k1" }, ((TargetUser)inst.Value).KeyIds);
    }

    [Fact]
    public void CompareTargetUser_CurrentEmpty_ReturnsSetInstructionWithEmptyKeyIds()
    {
        var original = new TargetUser { VariationId = "v1", KeyIds = new[] { "k1" } };

        var result = FlagComparer.CompareTargetUser("v1", original, null!).ToList();

        var inst = Assert.IsType<TargetUsersInstruction>(result.Single());
        Assert.Equal(FlagInstructionKind.SetTargetUsers, inst.Kind);
        Assert.Empty(((TargetUser)inst.Value).KeyIds);
    }

    [Fact]
    public void CompareTargetUser_AddedAndRemovedKeys_ProducesAddAndRemove()
    {
        var original = new TargetUser { VariationId = "v1", KeyIds = new[] { "k1", "k2" } };
        var current = new TargetUser { VariationId = "v1", KeyIds = new[] { "k2", "k3" } };

        var result = FlagComparer.CompareTargetUser("v1", original, current).ToList();

        Assert.Equal(2, result.Count);
        var add = result.Single(x => x.Kind == FlagInstructionKind.AddTargetUsers);
        var remove = result.Single(x => x.Kind == FlagInstructionKind.RemoveTargetUsers);
        Assert.Equal(new[] { "k3" }, ((TargetUser)add.Value).KeyIds);
        Assert.Equal(new[] { "k1" }, ((TargetUser)remove.Value).KeyIds);
    }

    [Fact]
    public void CompareRules_BothEmpty_ReturnsNoop()
    {
        var result = FlagComparer.CompareRules(Array.Empty<TargetRule>(), Array.Empty<TargetRule>()).ToList();

        Assert.IsType<NoopFlagInstruction>(result.Single());
    }

    [Fact]
    public void CompareRules_OriginalEmpty_ReturnsSetRules()
    {
        var current = new[] { new TargetRule { Id = "r1", Name = "n1", Conditions = new List<Condition>(), Variations = new List<RolloutVariation>() } };

        var result = FlagComparer.CompareRules(Array.Empty<TargetRule>(), current).ToList();

        Assert.IsType<SetRulesInstruction>(result.Single());
    }

    [Fact]
    public void CompareRules_AddRemoveAndUpdate_ProducesCorrectInstructions()
    {
        var commonOriginal = new TargetRule
        {
            Id = "r1", Name = "old",
            Conditions = new List<Condition>(),
            Variations = new List<RolloutVariation> { Rollout("v1") }
        };
        var commonCurrent = new TargetRule
        {
            Id = "r1", Name = "new",
            Conditions = new List<Condition>(),
            Variations = new List<RolloutVariation> { Rollout("v1") }
        };
        var removedRule = new TargetRule
        {
            Id = "r2", Name = "r2",
            Conditions = new List<Condition>(),
            Variations = new List<RolloutVariation>()
        };
        var addedRule = new TargetRule
        {
            Id = "r3", Name = "r3",
            Conditions = new List<Condition>(),
            Variations = new List<RolloutVariation>()
        };

        var result = FlagComparer.CompareRules(new[] { commonOriginal, removedRule }, new[] { commonCurrent, addedRule }).ToList();

        Assert.Contains(result, x => x is AddRuleInstruction);
        Assert.Contains(result, x => x is RemoveRuleInstruction);
        Assert.Contains(result, x => x is RuleNameInstruction);
    }

    [Fact]
    public void CompareCondition_StringValueChanged_EmitsUpdateConditionInstruction()
    {
        var original = new Condition { Id = "c1", Property = "p", Op = OperatorTypes.Equal, Value = "a" };
        var current = new Condition { Id = "c1", Property = "p", Op = OperatorTypes.Equal, Value = "b" };

        var result = FlagComparer.CompareCondition("r1", original, current).ToList();

        Assert.IsType<UpdateConditionInstruction>(result.Single());
    }

    [Fact]
    public void CompareCondition_MultiValueOpValueDifferent_EmitsAddAndRemoveValues()
    {
        var original = new Condition
        {
            Id = "c1", Property = "p", Op = OperatorTypes.IsOneOf,
            Value = JsonSerializer.Serialize(new[] { "a", "b" })
        };
        var current = new Condition
        {
            Id = "c1", Property = "p", Op = OperatorTypes.IsOneOf,
            Value = JsonSerializer.Serialize(new[] { "b", "c" })
        };

        var result = FlagComparer.CompareCondition("r1", original, current).ToList();

        Assert.Equal(2, result.Count);
        Assert.Contains(result, x => x.Kind == FlagInstructionKind.AddValuesToRuleCondition);
        Assert.Contains(result, x => x.Kind == FlagInstructionKind.RemoveValuesFromRuleCondition);
    }

    [Fact]
    public void CompareCondition_SegmentValueChanged_EmitsAddAndRemoveValues()
    {
        var original = new Condition
        {
            Id = "c1", Property = SegmentConsts.IsInSegment, Op = "x",
            Value = JsonSerializer.Serialize(new[] { Guid.Empty.ToString() })
        };
        var current = new Condition
        {
            Id = "c1", Property = SegmentConsts.IsInSegment, Op = "x",
            Value = JsonSerializer.Serialize(new[] { Guid.NewGuid().ToString() })
        };

        var result = FlagComparer.CompareCondition("r1", original, current).ToList();

        Assert.Contains(result, x => x.Kind == FlagInstructionKind.AddValuesToRuleCondition);
        Assert.Contains(result, x => x.Kind == FlagInstructionKind.RemoveValuesFromRuleCondition);
    }

    [Fact]
    public void Compare_TopLevel_NameOrDescriptionOnly_OmitsNoops()
    {
        var original = MakeFlag(name: "old", description: "d");
        var current = MakeFlag(name: "new", description: "d");

        var instructions = FlagComparer.Compare(original, current).ToList();

        Assert.All(instructions, i => Assert.NotEqual(FlagInstructionKind.Noop, i.Kind));
        Assert.Contains(instructions, i => i.Kind == FlagInstructionKind.UpdateName);
    }

    private static FeatureFlag MakeFlag(string name = "n", string description = "d") => new()
    {
        Name = name,
        Description = description,
        IsEnabled = true,
        IsArchived = false,
        Tags = Array.Empty<string>(),
        VariationType = VariationTypes.String,
        Variations = new List<Variation> { Var("v1") },
        DisabledVariationId = "v1",
        Fallthrough = new Fallthrough
        {
            Variations = new List<RolloutVariation> { Rollout("v1") },
            DispatchKey = "k"
        },
        TargetUsers = new List<TargetUser>(),
        Rules = new List<TargetRule>()
    };
}
