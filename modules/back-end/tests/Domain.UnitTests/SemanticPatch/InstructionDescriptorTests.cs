using Domain.FeatureFlags;
using Domain.SemanticPatch;
using Domain.Segments;
using Domain.Targeting;

namespace Domain.UnitTests.SemanticPatch;

public class InstructionDescriptorTests
{
    private static FeatureFlag MakeFlag(string name = "flagX") => new()
    {
        Name = name,
        Description = "desc",
        Tags = new[] { "t" },
        Variations = new List<Variation>
        {
            new() { Id = "v1", Name = "VariationOne", Value = "a" },
            new() { Id = "v2", Name = "VariationTwo", Value = "b" }
        },
        Rules = new List<TargetRule>
        {
            new() { Id = "r1", Name = "RuleOne", Conditions = new List<Condition>(), Variations = new List<RolloutVariation>() }
        }
    };

    [Theory]
    [InlineData(FlagInstructionKind.TurnFlagOn, "Turn on flag: flagX")]
    [InlineData(FlagInstructionKind.TurnFlagOff, "Turn off flag: flagX")]
    [InlineData(FlagInstructionKind.ArchiveFlag, "Archive flag: flagX")]
    [InlineData(FlagInstructionKind.RestoreFlag, "Restore flag: flagX")]
    public void Describe_Flag_TopLevelKinds_ReturnsExpected(string kind, string expected)
    {
        var instruction = new StatusInstruction(kind);

        var actual = InstructionDescriptor.Describe(instruction, MakeFlag(), MakeFlag());

        Assert.Equal(expected, actual);
    }

    [Fact]
    public void Describe_Flag_UpdateDisabledVariation_NamesVariation()
    {
        var instruction = new DisabledVariationInstruction("v2");

        var actual = InstructionDescriptor.Describe(instruction, MakeFlag(), MakeFlag());

        Assert.Equal("Disabled variation updated to 'VariationTwo'", actual);
    }

    [Fact]
    public void Describe_Flag_AddVariation_NamesNewVariation()
    {
        var instruction = new AddVariationInstruction(new Variation { Id = "v3", Name = "VarThree", Value = "c" });

        var actual = InstructionDescriptor.Describe(instruction, MakeFlag(), MakeFlag());

        Assert.Equal("Add variation: VarThree", actual);
    }

    [Fact]
    public void Describe_Flag_RemoveVariation_NamesRemovedVariationFromOrigin()
    {
        var instruction = new RemoveVariationInstruction("v1");

        var actual = InstructionDescriptor.Describe(instruction, MakeFlag(), MakeFlag());

        Assert.Equal("Remove variation: VariationOne", actual);
    }

    [Fact]
    public void Describe_Flag_UpdateVariation_IncludesNameAndValue()
    {
        var instruction = new UpdateVariationInstruction(new Variation { Id = "v1", Name = "Renamed", Value = "new-val" });

        var actual = InstructionDescriptor.Describe(instruction, MakeFlag(), MakeFlag());

        Assert.Equal("Variation updated to 'Renamed' with value 'new-val'", actual);
    }

    [Fact]
    public void Describe_Flag_UpdateVariationType_IncludesType()
    {
        var instruction = new VariationTypeInstruction(VariationTypes.Boolean);

        var actual = InstructionDescriptor.Describe(instruction, MakeFlag(), MakeFlag());

        Assert.Equal("Variation type updated to 'boolean'", actual);
    }

    [Theory]
    [InlineData(FlagInstructionKind.UpdateDefaultRuleVariationOrRollouts, "Update default rule variation")]
    [InlineData(FlagInstructionKind.UpdateDefaultRuleDispatchKey, "Update default rule dispatch key")]
    public void Describe_Flag_DefaultRuleKinds_ReturnsExpected(string kind, string expected)
    {
        var instruction = kind == FlagInstructionKind.UpdateDefaultRuleDispatchKey
            ? (FlagInstruction)new UpdateDefaultRuleDispatchKeyInstruction("k")
            : new UpdateDefaultRuleVariationOrRolloutInstruction(new DefaultRuleRolloutVariations { RolloutVariations = Array.Empty<RolloutVariation>() });

        var actual = InstructionDescriptor.Describe(instruction, MakeFlag(), MakeFlag());

        Assert.Equal(expected, actual);
    }

    [Theory]
    [InlineData(FlagInstructionKind.AddTargetUsers, "Add target users to variation 'VariationOne'")]
    [InlineData(FlagInstructionKind.RemoveTargetUsers, "Remove target users from variation 'VariationOne'")]
    public void Describe_Flag_TargetUsersAddOrRemove_NamesVariation(string kind, string expected)
    {
        var instruction = new TargetUsersInstruction(kind, new TargetUser { VariationId = "v1", KeyIds = new[] { "k" } });

        var actual = InstructionDescriptor.Describe(instruction, MakeFlag(), MakeFlag());

        Assert.Equal(expected, actual);
    }

    [Fact]
    public void Describe_Flag_SetTargetUsers_WithKeyIds_ReturnsSetMessage()
    {
        var instruction = new TargetUsersInstruction(
            FlagInstructionKind.SetTargetUsers, new TargetUser { VariationId = "v1", KeyIds = new[] { "k" } });

        var actual = InstructionDescriptor.Describe(instruction, MakeFlag(), MakeFlag());

        Assert.Equal("Set target users for variation 'VariationOne'", actual);
    }

    [Fact]
    public void Describe_Flag_SetTargetUsers_EmptyKeyIds_ReturnsClearMessage()
    {
        var instruction = new TargetUsersInstruction(
            FlagInstructionKind.SetTargetUsers, new TargetUser { VariationId = "v1", KeyIds = Array.Empty<string>() });

        var actual = InstructionDescriptor.Describe(instruction, MakeFlag(), MakeFlag());

        Assert.Equal("Clear target users for variation 'VariationOne'", actual);
    }

    [Fact]
    public void Describe_Flag_AddRule_NamesAddedRule()
    {
        var instruction = new AddRuleInstruction(new TargetRule
        {
            Id = "rX", Name = "MyRule", Conditions = new List<Condition>(), Variations = new List<RolloutVariation>()
        });

        var actual = InstructionDescriptor.Describe(instruction, MakeFlag(), MakeFlag());

        Assert.Equal("Add rule: MyRule", actual);
    }

    [Fact]
    public void Describe_Flag_RemoveRule_NamesRuleFromOrigin()
    {
        var instruction = new RemoveRuleInstruction("r1");

        var actual = InstructionDescriptor.Describe(instruction, MakeFlag(), MakeFlag());

        Assert.Equal("Remove rule: RuleOne", actual);
    }

    [Fact]
    public void Describe_Flag_SetRules_EmptyList_ReturnsClear()
    {
        var instruction = new SetRulesInstruction(Array.Empty<TargetRule>());

        var actual = InstructionDescriptor.Describe(instruction, MakeFlag(), MakeFlag());

        Assert.Equal("Clear rules", actual);
    }

    [Fact]
    public void Describe_Flag_SetRules_NonEmpty_JoinsNames()
    {
        var rules = new[]
        {
            new TargetRule { Id = "a", Name = "A", Conditions = new List<Condition>(), Variations = new List<RolloutVariation>() },
            new TargetRule { Id = "b", Name = "B", Conditions = new List<Condition>(), Variations = new List<RolloutVariation>() }
        };
        var instruction = new SetRulesInstruction(rules);

        var actual = InstructionDescriptor.Describe(instruction, MakeFlag(), MakeFlag());

        Assert.Equal("Set rules: A,B", actual);
    }

    [Fact]
    public void Describe_Flag_RuleUpdateKind_NamesRuleFromCurrent()
    {
        var instruction = new RuleNameInstruction(new RuleName { RuleId = "r1", Name = "Renamed" });

        var actual = InstructionDescriptor.Describe(instruction, MakeFlag(), MakeFlag());

        Assert.Equal("Update rule: RuleOne", actual);
    }

    [Fact]
    public void Describe_Flag_UpdateName_IncludesOldAndNew()
    {
        var instruction = new NameInstruction("new");
        var origin = MakeFlag("old");
        var current = MakeFlag("new");

        var actual = InstructionDescriptor.Describe(instruction, origin, current);

        Assert.Equal("Update name from old to new", actual);
    }

    [Fact]
    public void Describe_Flag_UpdateDescription_IncludesOldAndNew()
    {
        var instruction = new DescriptionInstruction("new");
        var origin = MakeFlag();
        origin.Description = "old";
        var current = MakeFlag();
        current.Description = "new";

        var actual = InstructionDescriptor.Describe(instruction, origin, current);

        Assert.Equal("Update description from old to new", actual);
    }

    [Fact]
    public void Describe_Flag_AddTags_IncludesOldAndNew()
    {
        var instruction = new TagsInstruction(FlagInstructionKind.AddTags, new[] { "b" });
        var origin = MakeFlag();
        origin.Tags = new[] { "a" };
        var current = MakeFlag();
        current.Tags = new[] { "a", "b" };

        var actual = InstructionDescriptor.Describe(instruction, origin, current);

        Assert.Equal("Update tags from a to a,b", actual);
    }

    [Fact]
    public void Describe_Flag_NoopOrUnknownKind_ReturnsEmpty()
    {
        var actual = InstructionDescriptor.Describe(NoopFlagInstruction.Instance, MakeFlag(), MakeFlag());

        Assert.Equal(string.Empty, actual);
    }

    private static Segment MakeSegment(string name = "segX", string description = "d") => new(
        workspaceId: Guid.NewGuid(),
        envId: Guid.NewGuid(),
        name: name,
        key: "k",
        type: SegmentType.EnvironmentSpecific,
        scopes: Array.Empty<string>(),
        included: Array.Empty<string>(),
        excluded: Array.Empty<string>(),
        rules: new List<MatchRule>
        {
            new() { Id = "r1", Name = "SegRule1", Conditions = new List<Condition>() }
        },
        description: description);

    [Theory]
    [InlineData(SegmentInstructionKind.Archive, "Archive segment: segX")]
    [InlineData(SegmentInstructionKind.Restore, "Restore segment: segX")]
    public void Describe_Segment_ArchiveAndRestore_ReturnsExpected(string kind, string expected)
    {
        var instruction = new SegmentArchiveInstruction(kind);

        var actual = InstructionDescriptor.Describe(instruction, MakeSegment(), MakeSegment());

        Assert.Equal(expected, actual);
    }

    [Fact]
    public void Describe_Segment_AddRule_NamesAddedRule()
    {
        var instruction = new AddSegmentRuleInstruction(new MatchRule { Id = "rX", Name = "NewRule", Conditions = new List<Condition>() });

        var actual = InstructionDescriptor.Describe(instruction, MakeSegment(), MakeSegment());

        Assert.Equal("Add rule: NewRule", actual);
    }

    [Fact]
    public void Describe_Segment_RemoveRule_NamesRuleFromOrigin()
    {
        var instruction = new RemoveSegmentRuleInstruction("r1");

        var actual = InstructionDescriptor.Describe(instruction, MakeSegment(), MakeSegment());

        Assert.Equal("Remove rule: SegRule1", actual);
    }

    [Fact]
    public void Describe_Segment_SetRules_EmptyClearsRules()
    {
        var instruction = new SetSegmentRulesInstruction(Array.Empty<MatchRule>());

        var actual = InstructionDescriptor.Describe(instruction, MakeSegment(), MakeSegment());

        Assert.Equal("Clear rules", actual);
    }

    [Fact]
    public void Describe_Segment_RuleUpdateKind_NamesRuleFromCurrent()
    {
        var instruction = new SegmentRuleNameInstruction(new RuleName { RuleId = "r1", Name = "x" });

        var actual = InstructionDescriptor.Describe(instruction, MakeSegment(), MakeSegment());

        Assert.Equal("Update rule: SegRule1", actual);
    }

    [Theory]
    [InlineData(SegmentInstructionKind.AddTargetUsersToIncluded, "Add including users")]
    [InlineData(SegmentInstructionKind.RemoveTargetUsersFromIncluded, "Remove including users")]
    [InlineData(SegmentInstructionKind.AddTargetUsersToExcluded, "Add excluding users")]
    [InlineData(SegmentInstructionKind.RemoveTargetUsersFromExcluded, "Remove excluding users")]
    public void Describe_Segment_TargetUserKinds_ReturnsConstantPhrase(string kind, string expected)
    {
        var instruction = new SegmentTargetUserInstruction(kind, Array.Empty<string>());

        var actual = InstructionDescriptor.Describe(instruction, MakeSegment(), MakeSegment());

        Assert.Equal(expected, actual);
    }

    [Fact]
    public void Describe_Segment_UpdateName_IncludesOldAndNew()
    {
        var origin = MakeSegment("old");
        var current = MakeSegment("new");
        var instruction = new SegmentNameInstruction("new");

        var actual = InstructionDescriptor.Describe(instruction, origin, current);

        Assert.Equal("Update name from old to new", actual);
    }

    [Fact]
    public void Describe_Segment_UpdateDescription_IncludesOldAndNew()
    {
        var origin = MakeSegment(description: "old");
        var current = MakeSegment(description: "new");
        var instruction = new SegmentDescriptionInstruction("new");

        var actual = InstructionDescriptor.Describe(instruction, origin, current);

        Assert.Equal("Update description from old to new", actual);
    }
}
