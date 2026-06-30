using Domain.SemanticPatch;

namespace Domain.UnitTests.SemanticPatch;

public class SegmentInstructionKindTests
{
    [Theory]
    [InlineData(SegmentInstructionKind.Archive)]
    [InlineData(SegmentInstructionKind.Restore)]
    [InlineData(SegmentInstructionKind.UpdateName)]
    [InlineData(SegmentInstructionKind.UpdateDescription)]
    [InlineData(SegmentInstructionKind.AddTags)]
    [InlineData(SegmentInstructionKind.RemoveTags)]
    [InlineData(SegmentInstructionKind.AddRule)]
    [InlineData(SegmentInstructionKind.RemoveRule)]
    [InlineData(SegmentInstructionKind.SetRules)]
    [InlineData(SegmentInstructionKind.UpdateRuleName)]
    [InlineData(SegmentInstructionKind.AddRuleConditions)]
    [InlineData(SegmentInstructionKind.RemoveRuleConditions)]
    [InlineData(SegmentInstructionKind.UpdateRuleCondition)]
    [InlineData(SegmentInstructionKind.AddValuesToRuleCondition)]
    [InlineData(SegmentInstructionKind.RemoveValuesFromRuleCondition)]
    [InlineData(SegmentInstructionKind.AddTargetUsersToIncluded)]
    [InlineData(SegmentInstructionKind.RemoveTargetUsersFromIncluded)]
    [InlineData(SegmentInstructionKind.AddTargetUsersToExcluded)]
    [InlineData(SegmentInstructionKind.RemoveTargetUsersFromExcluded)]
    [InlineData(SegmentInstructionKind.Noop)]
    public void IsDefined_RecognizedKind_ReturnsTrue(string kind)
    {
        Assert.True(SegmentInstructionKind.IsDefined(kind));
    }

    [Theory]
    [InlineData("")]
    [InlineData("archive")]
    [InlineData("not-a-kind")]
    public void IsDefined_UnknownKind_ReturnsFalse(string kind)
    {
        Assert.False(SegmentInstructionKind.IsDefined(kind));
    }

    [Fact]
    public void UpdateTargetUsersKinds_ContainsAllFourTargetUserKinds()
    {
        Assert.Equal(4, SegmentInstructionKind.UpdateTargetUsersKinds.Length);
        Assert.Contains(SegmentInstructionKind.AddTargetUsersToIncluded, SegmentInstructionKind.UpdateTargetUsersKinds);
        Assert.Contains(SegmentInstructionKind.RemoveTargetUsersFromExcluded, SegmentInstructionKind.UpdateTargetUsersKinds);
    }

    [Fact]
    public void UpdateRuleKinds_ContainsAllRuleMutationKinds()
    {
        Assert.Equal(9, SegmentInstructionKind.UpdateRuleKinds.Length);
    }

    [Fact]
    public void All_ListsEveryDefinedKind()
    {
        Assert.Equal(20, SegmentInstructionKind.All.Length);
        Assert.Contains(SegmentInstructionKind.Noop, SegmentInstructionKind.All);
    }
}
