using System.Text.Json;
using Domain.Utils;
using Domain.AuditLogs;
using Domain.FeatureFlags;
using Domain.FlagDrafts;
using Domain.SemanticPatch;
using Domain.Targeting;

namespace Domain.UnitTests.SemanticPatch;

public class RuleOrderDraftTests
{
    private static FeatureFlag Flag() => new()
    {
        Name = "flag", Tags = [], Variations = [], TargetUsers = [],
        Fallthrough = new Fallthrough { Variations = [] },
        Rules = new[] { "a", "b", "c" }.Select(id => new TargetRule
        {
            Id = id, Name = id, Conditions = [], Variations = []
        }).ToList()
    };

    private static FlagDraft Draft(FeatureFlag original)
    {
        var desired = original.Clone();
        desired.Rules = desired.Rules.Reverse().ToList();
        return new FlagDraft(Guid.NewGuid(), original.Id, new DataChange(original).To(desired), Guid.NewGuid());
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public void ApplyDraft_PreservesLaterEditsAdditionsAndDeletions(bool deleteRule)
    {
        var flag = Flag();
        var draft = Draft(flag);
        var a = flag.Rules.First();
        a.Name = "Live edit";
        a.DispatchKey = "email";
        a.Conditions = [new Condition { Id = "new-condition", Property = "country", Op = "Equal", Value = "fr" }];
        a.Variations = [new RolloutVariation { Id = "latest", Rollout = [0, 1] }];
        var added = new TargetRule { Id = "new", Name = "Added later", Conditions = [], Variations = [] };
        flag.Rules = deleteRule ? [a, added, flag.Rules.Last()] : [a, added, flag.Rules.ElementAt(1), flag.Rules.Last()];

        flag.ApplyDraft(draft);

        Assert.Equal(deleteRule ? new[] { "c", "new", "a" } : new[] { "c", "new", "b", "a" }, flag.Rules.Select(rule => rule.Id));
        Assert.Same(a, flag.Rules.Last());
        Assert.Same(added, flag.Rules.ElementAt(1));
        Assert.Equal("Live edit", a.Name);
        Assert.Equal("email", a.DispatchKey);
        Assert.Equal("fr", a.Conditions.Single().Value);
        Assert.Equal("latest", a.Variations.Single().Id);
    }

    [Fact]
    public void ApplyDraft_ConflictingOrderFailsBeforeOtherChanges()
    {
        var flag = Flag();
        var desired = flag.Clone();
        desired.Name = "Draft name";
        desired.Rules = desired.Rules.Reverse().ToList();
        var draft = new FlagDraft(Guid.NewGuid(), flag.Id, new DataChange(flag).To(desired), Guid.NewGuid());
        flag.Rules = [flag.Rules.ElementAt(1), flag.Rules.First(), flag.Rules.Last()];
        var before = JsonSerializer.Serialize(flag);
        var exception = Assert.Throws<FlagInstructionConflictException>(() => flag.ApplyDraft(draft));
        Assert.Equal(FlagInstructionKind.ReorderRules, exception.InstructionKind);
        Assert.Equal(before, JsonSerializer.Serialize(flag));
    }

    [Fact]
    public void ReorderInstruction_RoundTripsAndAllowsAlreadyAppliedOrder()
    {
        var flag = Flag();
        var instructions = Draft(flag).GetInstructions().ToArray();
        var json = JsonSerializer.SerializeToElement(instructions, ReusableJsonSerializerOptions.Web);
        var instruction = Assert.IsType<ReorderRulesInstruction>(Assert.Single(new FlagInstructions(json)));
        instruction.Apply(flag);
        instruction.Apply(flag);
        Assert.Equal(new[] { "c", "b", "a" }, flag.Rules.Select(rule => rule.Id));
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public void ApplyDraft_AdditionAndReorderAcceptsOriginalOrDesiredLiveOrder(bool alreadyReordered)
    {
        var flag = Flag();
        flag.Rules = flag.Rules.Take(2).ToList();
        var desired = flag.Clone();
        desired.Rules = [new TargetRule { Id = "c", Name = "c", Conditions = [], Variations = [] },
            desired.Rules.Last(), desired.Rules.First()];
        var draft = new FlagDraft(Guid.NewGuid(), flag.Id, new DataChange(flag).To(desired), Guid.NewGuid());
        var a = flag.Rules.First();
        a.Name = "Live edit";
        if (alreadyReordered) flag.Rules = flag.Rules.Reverse().ToList();

        flag.ApplyDraft(draft);

        Assert.Equal(new[] { "c", "b", "a" }, flag.Rules.Select(rule => rule.Id));
        Assert.Same(a, flag.Rules.Last());
        Assert.Equal("Live edit", a.Name);
    }

    [Fact]
    public void ReorderWithAddition_RoundTripsAndRejectsConflictingRetainedOrder()
    {
        var original = Flag();
        var desired = original.Clone();
        desired.Rules = desired.Rules.Reverse().ToList();
        desired.Rules = [new TargetRule { Id = "d", Name = "d", Conditions = [], Variations = [] }, .. desired.Rules];
        var json = JsonSerializer.SerializeToElement(FlagComparer.Compare(original, desired), ReusableJsonSerializerOptions.Web);
        var instructions = new FlagInstructions(json).ToArray();
        var reorder = Assert.Single(instructions.OfType<ReorderRulesInstruction>());
        var order = Assert.IsType<RuleOrder>(reorder.Value);
        Assert.Equal(new[] { "a", "b", "c" }, order.Previous);

        var conflicting = original.Clone();
        conflicting.Rules = [conflicting.Rules.ElementAt(1), conflicting.Rules.First(), conflicting.Rules.Last()];
        var exception = Assert.Throws<FlagInstructionConflictException>(() => reorder.Apply(conflicting));
        Assert.Equal(FlagInstructionKind.ReorderRules, exception.InstructionKind);

        original.Rules = original.Rules.Reverse().ToList();
        foreach (var instruction in instructions) instruction.Apply(original);
        Assert.Equal(new[] { "d", "c", "b", "a" }, original.Rules.Select(rule => rule.Id));
    }
}
