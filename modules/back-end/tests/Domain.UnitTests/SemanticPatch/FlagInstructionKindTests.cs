using Domain.SemanticPatch;

namespace Domain.UnitTests.SemanticPatch;

public class FlagInstructionKindTests
{
    [Theory]
    [InlineData(FlagInstructionKind.TurnFlagOn)]
    [InlineData(FlagInstructionKind.TurnFlagOff)]
    [InlineData(FlagInstructionKind.ArchiveFlag)]
    [InlineData(FlagInstructionKind.RestoreFlag)]
    [InlineData(FlagInstructionKind.UpdateName)]
    [InlineData(FlagInstructionKind.UpdateDescription)]
    [InlineData(FlagInstructionKind.AddTags)]
    [InlineData(FlagInstructionKind.RemoveTags)]
    [InlineData(FlagInstructionKind.AddVariation)]
    [InlineData(FlagInstructionKind.RemoveVariation)]
    [InlineData(FlagInstructionKind.UpdateVariation)]
    [InlineData(FlagInstructionKind.UpdateVariationType)]
    [InlineData(FlagInstructionKind.UpdateDisabledVariation)]
    [InlineData(FlagInstructionKind.UpdateDefaultRuleVariationOrRollouts)]
    [InlineData(FlagInstructionKind.UpdateDefaultRuleDispatchKey)]
    [InlineData(FlagInstructionKind.AddTargetUsers)]
    [InlineData(FlagInstructionKind.RemoveTargetUsers)]
    [InlineData(FlagInstructionKind.SetTargetUsers)]
    [InlineData(FlagInstructionKind.AddRule)]
    [InlineData(FlagInstructionKind.RemoveRule)]
    [InlineData(FlagInstructionKind.SetRules)]
    [InlineData(FlagInstructionKind.UpdateRuleName)]
    [InlineData(FlagInstructionKind.UpdateRuleDispatchKey)]
    [InlineData(FlagInstructionKind.AddRuleConditions)]
    [InlineData(FlagInstructionKind.RemoveRuleConditions)]
    [InlineData(FlagInstructionKind.UpdateRuleCondition)]
    [InlineData(FlagInstructionKind.AddValuesToRuleCondition)]
    [InlineData(FlagInstructionKind.RemoveValuesFromRuleCondition)]
    [InlineData(FlagInstructionKind.UpdateRuleVariationOrRollouts)]
    [InlineData(FlagInstructionKind.Noop)]
    public void IsDefined_RecognizedKind_ReturnsTrue(string kind)
    {
        Assert.True(FlagInstructionKind.IsDefined(kind));
    }

    [Theory]
    [InlineData("")]
    [InlineData("turnFlagOn")]
    [InlineData("not-a-kind")]
    public void IsDefined_UnknownKind_ReturnsFalse(string kind)
    {
        Assert.False(FlagInstructionKind.IsDefined(kind));
    }

    [Fact]
    public void UpdateDefaultRuleKinds_ContainsBothDefaultRuleKinds()
    {
        Assert.Contains(FlagInstructionKind.UpdateDefaultRuleVariationOrRollouts, FlagInstructionKind.UpdateDefaultRuleKinds);
        Assert.Contains(FlagInstructionKind.UpdateDefaultRuleDispatchKey, FlagInstructionKind.UpdateDefaultRuleKinds);
        Assert.Equal(2, FlagInstructionKind.UpdateDefaultRuleKinds.Length);
    }

    [Fact]
    public void UpdateTargetUsersKinds_ContainsAllThreeTargetUserKinds()
    {
        Assert.Equal(3, FlagInstructionKind.UpdateTargetUsersKinds.Length);
        Assert.Contains(FlagInstructionKind.AddTargetUsers, FlagInstructionKind.UpdateTargetUsersKinds);
        Assert.Contains(FlagInstructionKind.RemoveTargetUsers, FlagInstructionKind.UpdateTargetUsersKinds);
        Assert.Contains(FlagInstructionKind.SetTargetUsers, FlagInstructionKind.UpdateTargetUsersKinds);
    }

    [Fact]
    public void UpdateRuleKinds_ContainsAllRuleMutationKinds()
    {
        Assert.Equal(11, FlagInstructionKind.UpdateRuleKinds.Length);
    }

    [Fact]
    public void All_ListsEveryDefinedKind()
    {
        Assert.Equal(30, FlagInstructionKind.All.Length);
        Assert.Contains(FlagInstructionKind.Noop, FlagInstructionKind.All);
    }
}
