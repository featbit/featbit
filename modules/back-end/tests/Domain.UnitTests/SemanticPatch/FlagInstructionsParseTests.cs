using System.Text.Json;
using Domain.FeatureFlags;
using Domain.SemanticPatch;
using Domain.Targeting;

namespace Domain.UnitTests.SemanticPatch;

public class FlagInstructionsParseTests
{
    private static FlagInstructions Parse(string json)
    {
        var doc = JsonDocument.Parse(json);
        return new FlagInstructions(doc.RootElement);
    }

    [Fact]
    public void Ctor_NonArrayJson_YieldsEmptyEnumerable()
    {
        var instructions = Parse("{}");

        Assert.Empty(instructions);
    }

    [Fact]
    public void Ctor_EmptyArray_YieldsEmptyEnumerable()
    {
        var instructions = Parse("[]");

        Assert.Empty(instructions);
    }

    [Fact]
    public void Ctor_MissingKind_SkipsEntry()
    {
        var instructions = Parse("[{\"value\":\"abc\"}]");

        Assert.Empty(instructions);
    }

    [Fact]
    public void Ctor_UnknownKind_SkipsEntry()
    {
        var instructions = Parse("[{\"kind\":\"NotARealKind\",\"value\":\"x\"}]");

        Assert.Empty(instructions);
    }

    [Theory]
    [InlineData(FlagInstructionKind.TurnFlagOn, typeof(StatusInstruction))]
    [InlineData(FlagInstructionKind.TurnFlagOff, typeof(StatusInstruction))]
    [InlineData(FlagInstructionKind.ArchiveFlag, typeof(ArchiveInstruction))]
    [InlineData(FlagInstructionKind.RestoreFlag, typeof(ArchiveInstruction))]
    public void Ctor_FlagLevelInstructions_YieldsExpectedType(string kind, Type expected)
    {
        var instructions = Parse($"[{{\"kind\":\"{kind}\"}}]").ToList();

        Assert.Single(instructions);
        Assert.IsType(expected, instructions[0]);
        Assert.Equal(kind, instructions[0].Kind);
    }

    [Fact]
    public void Ctor_UpdateName_YieldsNameInstructionWithStringValue()
    {
        var instructions = Parse("[{\"kind\":\"UpdateName\",\"value\":\"new-name\"}]").ToList();

        var name = Assert.IsType<NameInstruction>(instructions[0]);
        Assert.Equal("new-name", name.Value);
    }

    [Fact]
    public void Ctor_AddTags_YieldsTagsInstructionWithCollection()
    {
        var instructions = Parse("[{\"kind\":\"AddTags\",\"value\":[\"a\",\"b\"]}]").ToList();

        var tags = Assert.IsType<TagsInstruction>(instructions[0]);
        Assert.Equal(FlagInstructionKind.AddTags, tags.Kind);
        Assert.Equal(new[] { "a", "b" }, (ICollection<string>)tags.Value);
    }

    [Fact]
    public void Ctor_AddVariation_DeserializesVariationFromValue()
    {
        const string json = "[{\"kind\":\"AddVariation\",\"value\":{\"id\":\"v1\",\"name\":\"N\",\"value\":\"V\"}}]";

        var instructions = Parse(json).ToList();

        var add = Assert.IsType<AddVariationInstruction>(instructions[0]);
        var variation = Assert.IsType<Variation>(add.Value);
        Assert.Equal("v1", variation.Id);
        Assert.Equal("N", variation.Name);
        Assert.Equal("V", variation.Value);
    }

    [Fact]
    public void Ctor_RemoveVariation_YieldsRemoveVariationInstructionWithIdString()
    {
        var instructions = Parse("[{\"kind\":\"RemoveVariation\",\"value\":\"v1\"}]").ToList();

        var inst = Assert.IsType<RemoveVariationInstruction>(instructions[0]);
        Assert.Equal("v1", inst.Value);
    }

    [Fact]
    public void Ctor_SetTargetUsers_DeserializesTargetUser()
    {
        const string json =
            "[{\"kind\":\"SetTargetUsers\",\"value\":{\"variationId\":\"v1\",\"keyIds\":[\"k1\",\"k2\"]}}]";

        var instructions = Parse(json).ToList();

        var inst = Assert.IsType<TargetUsersInstruction>(instructions[0]);
        var tu = Assert.IsType<TargetUser>(inst.Value);
        Assert.Equal("v1", tu.VariationId);
        Assert.Equal(new[] { "k1", "k2" }, tu.KeyIds);
    }

    [Fact]
    public void Ctor_MultipleInstructions_ParsesAllInOrder()
    {
        const string json = "[{\"kind\":\"TurnFlagOn\"},{\"kind\":\"UpdateName\",\"value\":\"x\"}]";

        var instructions = Parse(json).ToList();

        Assert.Equal(2, instructions.Count);
        Assert.IsType<StatusInstruction>(instructions[0]);
        Assert.IsType<NameInstruction>(instructions[1]);
    }

    [Fact]
    public void Ctor_RemoveRule_YieldsRemoveRuleInstructionWithRuleId()
    {
        var instructions = Parse("[{\"kind\":\"RemoveRule\",\"value\":\"rule-1\"}]").ToList();

        var inst = Assert.IsType<RemoveRuleInstruction>(instructions[0]);
        Assert.Equal("rule-1", inst.Value);
    }

    [Fact]
    public void Ctor_UpdateRuleName_DeserializesRuleName()
    {
        const string json =
            "[{\"kind\":\"UpdateRuleName\",\"value\":{\"ruleId\":\"r1\",\"name\":\"new-rule\"}}]";

        var instructions = Parse(json).ToList();

        var inst = Assert.IsType<RuleNameInstruction>(instructions[0]);
        var value = Assert.IsType<RuleName>(inst.Value);
        Assert.Equal("r1", value.RuleId);
        Assert.Equal("new-rule", value.Name);
    }
}
