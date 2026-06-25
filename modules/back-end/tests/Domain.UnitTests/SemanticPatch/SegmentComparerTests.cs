using Domain.SemanticPatch;
using Domain.Segments;
using Domain.Targeting;

namespace Domain.UnitTests.SemanticPatch;

public class SegmentComparerTests
{
    [Theory]
    [InlineData(false, true, SegmentInstructionKind.Archive)]
    [InlineData(true, false, SegmentInstructionKind.Restore)]
    public void CompareArchived_Changed_ReturnsArchiveOrRestore(bool original, bool current, string expected)
    {
        var result = SegmentComparer.CompareArchived(original, current);

        Assert.Equal(expected, result.Kind);
    }

    [Fact]
    public void CompareArchived_NoChange_ReturnsNoop()
    {
        Assert.Same(NoopSegmentInstruction.Instance, SegmentComparer.CompareArchived(false, false));
    }

    [Fact]
    public void CompareName_Changed_ReturnsNameInstruction()
    {
        var result = SegmentComparer.CompareName("old", "new");

        var inst = Assert.IsType<SegmentNameInstruction>(result);
        Assert.Equal("new", inst.Value);
    }

    [Fact]
    public void CompareName_Unchanged_ReturnsNoop()
    {
        Assert.Same(NoopSegmentInstruction.Instance, SegmentComparer.CompareName("x", "x"));
    }

    [Fact]
    public void CompareDescription_Changed_ReturnsDescriptionInstruction()
    {
        var result = SegmentComparer.CompareDescription("old", "new");

        var inst = Assert.IsType<SegmentDescriptionInstruction>(result);
        Assert.Equal("new", inst.Value);
    }

    [Fact]
    public void CompareTags_AddedAndRemoved_ProducesBothInstructions()
    {
        var result = SegmentComparer.CompareTags(new[] { "a", "b" }, new[] { "b", "c" }).ToList();

        Assert.Equal(2, result.Count);
        Assert.Contains(result, x => x.Kind == SegmentInstructionKind.AddTags);
        Assert.Contains(result, x => x.Kind == SegmentInstructionKind.RemoveTags);
    }

    [Fact]
    public void CompareTargetUsers_BothEmpty_ReturnsNoop()
    {
        var result = SegmentComparer.CompareTargetUsers(
            "included", Array.Empty<string>(), Array.Empty<string>()).ToList();

        Assert.IsType<NoopSegmentInstruction>(result.Single());
    }

    [Theory]
    [InlineData("included", SegmentInstructionKind.AddTargetUsersToIncluded, SegmentInstructionKind.RemoveTargetUsersFromIncluded)]
    [InlineData("excluded", SegmentInstructionKind.AddTargetUsersToExcluded, SegmentInstructionKind.RemoveTargetUsersFromExcluded)]
    public void CompareTargetUsers_Diff_EmitsAddAndRemoveKindsForCompareType(string compareType, string addKind, string removeKind)
    {
        var result = SegmentComparer.CompareTargetUsers(
            compareType, new[] { "a", "b" }, new[] { "b", "c" }).ToList();

        Assert.Equal(2, result.Count);
        Assert.Contains(result, x => x.Kind == addKind);
        Assert.Contains(result, x => x.Kind == removeKind);
    }

    [Fact]
    public void CompareRules_BothEmpty_ReturnsNoop()
    {
        var result = SegmentComparer.CompareRules(
            Array.Empty<MatchRule>(), Array.Empty<MatchRule>()).ToList();

        Assert.IsType<NoopSegmentInstruction>(result.Single());
    }

    [Fact]
    public void CompareRules_OriginalEmpty_ReturnsSetRules()
    {
        var rule = new MatchRule { Id = "r1", Name = "n1", Conditions = new List<Condition>() };

        var result = SegmentComparer.CompareRules(Array.Empty<MatchRule>(), new[] { rule }).ToList();

        Assert.IsType<SetSegmentRulesInstruction>(result.Single());
    }

    [Fact]
    public void CompareRules_AddRemoveAndUpdateName_ProducesCorrectInstructions()
    {
        var commonOriginal = new MatchRule { Id = "r1", Name = "old", Conditions = new List<Condition>() };
        var commonCurrent = new MatchRule { Id = "r1", Name = "new", Conditions = new List<Condition>() };
        var removed = new MatchRule { Id = "r2", Name = "r2", Conditions = new List<Condition>() };
        var added = new MatchRule { Id = "r3", Name = "r3", Conditions = new List<Condition>() };

        var result = SegmentComparer.CompareRules(
            new[] { commonOriginal, removed }, new[] { commonCurrent, added }).ToList();

        Assert.Contains(result, x => x is AddSegmentRuleInstruction);
        Assert.Contains(result, x => x is RemoveSegmentRuleInstruction);
        Assert.Contains(result, x => x is SegmentRuleNameInstruction);
    }

    [Fact]
    public void CompareRule_ConditionsAddedAndRemoved_EmitsBothInstructions()
    {
        var original = new MatchRule
        {
            Id = "r1", Name = "r1",
            Conditions = new List<Condition>
            {
                new() { Id = "c1", Property = "p", Op = OperatorTypes.Equal, Value = "a" }
            }
        };
        var current = new MatchRule
        {
            Id = "r1", Name = "r1",
            Conditions = new List<Condition>
            {
                new() { Id = "c2", Property = "p2", Op = OperatorTypes.Equal, Value = "b" }
            }
        };

        var result = SegmentComparer.CompareRule(original, current).ToList();

        Assert.Contains(result, x => x is SegmentAddConditionsInstruction);
        Assert.Contains(result, x => x is SegmentRemoveConditionsInstruction);
    }

    [Fact]
    public void CompareCondition_ValueChanged_EmitsUpdateConditionInstruction()
    {
        var original = new Condition { Id = "c1", Property = "p", Op = OperatorTypes.Equal, Value = "a" };
        var current = new Condition { Id = "c1", Property = "p", Op = OperatorTypes.Equal, Value = "b" };

        var result = SegmentComparer.CompareCondition("r1", original, current).ToList();

        Assert.IsType<SegmentUpdateConditionInstruction>(result.Single());
    }

    [Fact]
    public void Compare_TopLevel_NameChange_OmitsNoops()
    {
        var original = MakeSegment("old");
        var current = MakeSegment("new");

        var result = SegmentComparer.Compare(original, current).ToList();

        Assert.All(result, i => Assert.NotEqual(SegmentInstructionKind.Noop, i.Kind));
        Assert.Contains(result, i => i.Kind == SegmentInstructionKind.UpdateName);
    }

    private static Segment MakeSegment(string name) => new(
        workspaceId: Guid.NewGuid(),
        envId: Guid.NewGuid(),
        name: name,
        key: "k",
        type: SegmentType.EnvironmentSpecific,
        scopes: Array.Empty<string>(),
        included: Array.Empty<string>(),
        excluded: Array.Empty<string>(),
        rules: Array.Empty<MatchRule>(),
        description: "d");
}
