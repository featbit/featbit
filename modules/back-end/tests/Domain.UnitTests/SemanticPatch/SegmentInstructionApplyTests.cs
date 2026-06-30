using Domain.SemanticPatch;
using Domain.Segments;
using Domain.Targeting;

namespace Domain.UnitTests.SemanticPatch;

public class SegmentInstructionApplyTests
{
    private static Segment MakeSegment() => new(
        workspaceId: Guid.NewGuid(),
        envId: Guid.NewGuid(),
        name: "n",
        key: "k",
        type: SegmentType.EnvironmentSpecific,
        scopes: Array.Empty<string>(),
        included: Array.Empty<string>(),
        excluded: Array.Empty<string>(),
        rules: new List<MatchRule>
        {
            new()
            {
                Id = "r1", Name = "rule1",
                Conditions = new List<Condition>
                {
                    new() { Id = "c1", Property = "p", Op = OperatorTypes.Equal, Value = "a" }
                }
            }
        },
        description: "d");

    [Fact]
    public void SegmentArchiveInstruction_Archive_SetsIsArchivedTrue()
    {
        var seg = MakeSegment();

        new SegmentArchiveInstruction(SegmentInstructionKind.Archive).Apply(seg);

        Assert.True(seg.IsArchived);
    }

    [Fact]
    public void SegmentArchiveInstruction_Restore_SetsIsArchivedFalse()
    {
        var seg = MakeSegment();
        seg.IsArchived = true;

        new SegmentArchiveInstruction(SegmentInstructionKind.Restore).Apply(seg);

        Assert.False(seg.IsArchived);
    }

    [Fact]
    public void SegmentNameInstruction_Apply_UpdatesName()
    {
        var seg = MakeSegment();

        new SegmentNameInstruction("renamed").Apply(seg);

        Assert.Equal("renamed", seg.Name);
    }

    [Fact]
    public void SegmentDescriptionInstruction_Apply_UpdatesDescription()
    {
        var seg = MakeSegment();

        new SegmentDescriptionInstruction("new-desc").Apply(seg);

        Assert.Equal("new-desc", seg.Description);
    }

    [Fact]
    public void SegmentTagsInstruction_AddTags_UnionsWithExisting()
    {
        var seg = MakeSegment();
        seg.Tags = new[] { "a" };

        new SegmentTagsInstruction(SegmentInstructionKind.AddTags, new[] { "b" }).Apply(seg);

        Assert.Equal(new[] { "a", "b" }, seg.Tags);
    }

    [Fact]
    public void SegmentTagsInstruction_RemoveTags_RemovesMatchingTags()
    {
        var seg = MakeSegment();
        seg.Tags = new[] { "a", "b" };

        new SegmentTagsInstruction(SegmentInstructionKind.RemoveTags, new[] { "a" }).Apply(seg);

        Assert.Equal(new[] { "b" }, seg.Tags);
    }

    [Fact]
    public void SetSegmentRulesInstruction_Apply_ReplacesAllRules()
    {
        var seg = MakeSegment();
        var rules = new List<MatchRule>();

        new SetSegmentRulesInstruction(rules).Apply(seg);

        Assert.Same(rules, seg.Rules);
    }

    [Fact]
    public void AddSegmentRuleInstruction_Apply_AppendsRule()
    {
        var seg = MakeSegment();
        var rule = new MatchRule { Id = "r2", Name = "r2", Conditions = new List<Condition>() };

        new AddSegmentRuleInstruction(rule).Apply(seg);

        Assert.Contains(seg.Rules, r => r.Id == "r2");
    }

    [Fact]
    public void RemoveSegmentRuleInstruction_Apply_RemovesById()
    {
        var seg = MakeSegment();

        new RemoveSegmentRuleInstruction("r1").Apply(seg);

        Assert.Empty(seg.Rules);
    }

    [Fact]
    public void SegmentRuleNameInstruction_Apply_RenamesMatchingRule()
    {
        var seg = MakeSegment();

        new SegmentRuleNameInstruction(new RuleName { RuleId = "r1", Name = "new" }).Apply(seg);

        Assert.Equal("new", seg.Rules.Single().Name);
    }

    [Fact]
    public void SegmentRemoveConditionsInstruction_Apply_RemovesNamedConditions()
    {
        var seg = MakeSegment();
        seg.Rules.First().Conditions.Add(new Condition { Id = "c2", Property = "p", Op = OperatorTypes.Equal, Value = "x" });

        new SegmentRemoveConditionsInstruction(new RuleConditionIds { RuleId = "r1", ConditionIds = new[] { "c1" } }).Apply(seg);

        var conditions = seg.Rules.Single().Conditions;
        Assert.Single(conditions);
        Assert.Equal("c2", conditions.Single().Id);
    }

    [Fact]
    public void SegmentAddConditionsInstruction_Apply_AppendsConditions()
    {
        var seg = MakeSegment();

        new SegmentAddConditionsInstruction(new RuleConditions
        {
            RuleId = "r1",
            Conditions = new[]
            {
                new Condition { Id = "c2", Property = "p2", Op = OperatorTypes.Equal, Value = "b" }
            }
        }).Apply(seg);

        Assert.Equal(2, seg.Rules.Single().Conditions.Count);
    }

    [Fact]
    public void SegmentUpdateConditionInstruction_Apply_AssignsMatchingCondition()
    {
        var seg = MakeSegment();

        new SegmentUpdateConditionInstruction(new RuleCondition
        {
            RuleId = "r1",
            Condition = new Condition { Id = "c1", Property = "p2", Op = OperatorTypes.NotEqual, Value = "z" }
        }).Apply(seg);

        var c = seg.Rules.Single().Conditions.Single();
        Assert.Equal("p2", c.Property);
        Assert.Equal(OperatorTypes.NotEqual, c.Op);
        Assert.Equal("z", c.Value);
    }

    [Fact]
    public void SegmentAddValuesToConditionInstruction_Apply_AppendsValues()
    {
        var seg = MakeSegment();
        seg.Rules.First().Conditions = new List<Condition>
        {
            new() { Id = "c1", Property = "p", Op = OperatorTypes.IsOneOf, Value = "[\"a\"]" }
        };

        new SegmentAddValuesToConditionInstruction(new RuleConditionValues
        {
            RuleId = "r1", ConditionId = "c1", Values = new[] { "b" }
        }).Apply(seg);

        Assert.Equal("[\"a\",\"b\"]", seg.Rules.Single().Conditions.Single().Value);
    }

    [Fact]
    public void SegmentRemoveValuesFromConditionInstruction_Apply_RemovesValues()
    {
        var seg = MakeSegment();
        seg.Rules.First().Conditions = new List<Condition>
        {
            new() { Id = "c1", Property = "p", Op = OperatorTypes.IsOneOf, Value = "[\"a\",\"b\"]" }
        };

        new SegmentRemoveValuesFromConditionInstruction(new RuleConditionValues
        {
            RuleId = "r1", ConditionId = "c1", Values = new[] { "a" }
        }).Apply(seg);

        Assert.Equal("[\"b\"]", seg.Rules.Single().Conditions.Single().Value);
    }

    [Fact]
    public void NoopSegmentInstruction_Apply_DoesNotMutateSegment()
    {
        var seg = MakeSegment();

        NoopSegmentInstruction.Instance.Apply(seg);

        Assert.Equal("n", seg.Name);
    }
}
