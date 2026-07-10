using Domain.FeatureFlags;
using Domain.SemanticPatch;
using Domain.Targeting;

namespace Domain.UnitTests.SemanticPatch;

public class FlagInstructionApplyTests
{
    private static FeatureFlag MakeFlag() => new()
    {
        Name = "n", Description = "d",
        IsEnabled = false, IsArchived = false,
        Tags = new[] { "a" },
        VariationType = VariationTypes.String,
        Variations = new List<Variation>
        {
            new() { Id = "v1", Name = "Var1", Value = "val1" },
            new() { Id = "v2", Name = "Var2", Value = "val2" }
        },
        DisabledVariationId = "v1",
        Fallthrough = new Fallthrough
        {
            DispatchKey = "old-key",
            Variations = new List<RolloutVariation>
            {
                new() { Id = "v1", Rollout = new[] { 0.0, 1.0 } }
            }
        },
        TargetUsers = new List<TargetUser>(),
        Rules = new List<TargetRule>()
    };

    [Fact]
    public void StatusInstruction_TurnFlagOn_EnablesFlag()
    {
        var flag = MakeFlag();

        new StatusInstruction(FlagInstructionKind.TurnFlagOn).Apply(flag);

        Assert.True(flag.IsEnabled);
    }

    [Fact]
    public void StatusInstruction_TurnFlagOff_DisablesFlag()
    {
        var flag = MakeFlag();
        flag.IsEnabled = true;

        new StatusInstruction(FlagInstructionKind.TurnFlagOff).Apply(flag);

        Assert.False(flag.IsEnabled);
    }

    [Fact]
    public void ArchiveInstruction_ArchiveFlag_SetsIsArchivedTrue()
    {
        var flag = MakeFlag();

        new ArchiveInstruction(FlagInstructionKind.ArchiveFlag).Apply(flag);

        Assert.True(flag.IsArchived);
    }

    [Fact]
    public void ArchiveInstruction_RestoreFlag_SetsIsArchivedFalse()
    {
        var flag = MakeFlag();
        flag.IsArchived = true;

        new ArchiveInstruction(FlagInstructionKind.RestoreFlag).Apply(flag);

        Assert.False(flag.IsArchived);
    }

    [Fact]
    public void NameInstruction_Apply_UpdatesName()
    {
        var flag = MakeFlag();

        new NameInstruction("renamed").Apply(flag);

        Assert.Equal("renamed", flag.Name);
    }

    [Fact]
    public void DescriptionInstruction_Apply_UpdatesDescription()
    {
        var flag = MakeFlag();

        new DescriptionInstruction("new-desc").Apply(flag);

        Assert.Equal("new-desc", flag.Description);
    }

    [Fact]
    public void TagsInstruction_AddTags_UnionsWithExisting()
    {
        var flag = MakeFlag();

        new TagsInstruction(FlagInstructionKind.AddTags, new[] { "b" }).Apply(flag);

        Assert.Equal(new[] { "a", "b" }, flag.Tags);
    }

    [Fact]
    public void TagsInstruction_RemoveTags_RemovesMatchingTags()
    {
        var flag = MakeFlag();

        new TagsInstruction(FlagInstructionKind.RemoveTags, new[] { "a" }).Apply(flag);

        Assert.Empty(flag.Tags);
    }

    [Fact]
    public void AddVariationInstruction_Apply_AppendsVariation()
    {
        var flag = MakeFlag();
        var v = new Variation { Id = "v3", Name = "n3", Value = "vv3" };

        new AddVariationInstruction(v).Apply(flag);

        Assert.Contains(flag.Variations, x => x.Id == "v3");
    }

    [Fact]
    public void RemoveVariationInstruction_Apply_RemovesByIdWhenPresent()
    {
        var flag = MakeFlag();

        new RemoveVariationInstruction("v1").Apply(flag);

        Assert.DoesNotContain(flag.Variations, x => x.Id == "v1");
    }

    [Fact]
    public void RemoveVariationInstruction_Apply_NoopWhenIdMissing()
    {
        var flag = MakeFlag();
        var before = flag.Variations.Count;

        new RemoveVariationInstruction("missing").Apply(flag);

        Assert.Equal(before, flag.Variations.Count);
    }

    [Fact]
    public void UpdateVariationInstruction_Apply_AssignsNameAndValue()
    {
        var flag = MakeFlag();
        var updated = new Variation { Id = "v1", Name = "renamed", Value = "newval" };

        new UpdateVariationInstruction(updated).Apply(flag);

        var v1 = flag.Variations.Single(x => x.Id == "v1");
        Assert.Equal("renamed", v1.Name);
        Assert.Equal("newval", v1.Value);
    }

    [Fact]
    public void DisabledVariationInstruction_Apply_SetsIdWhenVariationExists()
    {
        var flag = MakeFlag();

        new DisabledVariationInstruction("v2").Apply(flag);

        Assert.Equal("v2", flag.DisabledVariationId);
    }

    [Fact]
    public void DisabledVariationInstruction_Apply_NoopWhenIdMissing()
    {
        var flag = MakeFlag();

        new DisabledVariationInstruction("missing").Apply(flag);

        Assert.Equal("v1", flag.DisabledVariationId);
    }

    [Fact]
    public void VariationTypeInstruction_Apply_AcceptsDefinedType()
    {
        var flag = MakeFlag();

        new VariationTypeInstruction(VariationTypes.Boolean).Apply(flag);

        Assert.Equal(VariationTypes.Boolean, flag.VariationType);
    }

    [Fact]
    public void VariationTypeInstruction_Apply_RejectsUndefinedType()
    {
        var flag = MakeFlag();

        new VariationTypeInstruction("not-a-type").Apply(flag);

        Assert.Equal(VariationTypes.String, flag.VariationType);
    }

    [Fact]
    public void UpdateDefaultRuleVariationOrRolloutInstruction_Apply_ReplacesFallthroughVariations()
    {
        var flag = MakeFlag();
        var newRollouts = new List<RolloutVariation>
        {
            new() { Id = "v2", Rollout = new[] { 0.0, 1.0 } }
        };

        new UpdateDefaultRuleVariationOrRolloutInstruction(
            new DefaultRuleRolloutVariations { RolloutVariations = newRollouts }).Apply(flag);

        Assert.Equal("v2", flag.Fallthrough.Variations.Single().Id);
    }

    [Fact]
    public void UpdateDefaultRuleDispatchKeyInstruction_Apply_ReplacesDispatchKey()
    {
        var flag = MakeFlag();

        new UpdateDefaultRuleDispatchKeyInstruction("new-key").Apply(flag);

        Assert.Equal("new-key", flag.Fallthrough.DispatchKey);
    }

    [Fact]
    public void TargetUsersInstruction_AddTargetUsers_AddsNewWhenVariationAbsent()
    {
        var flag = MakeFlag();

        new TargetUsersInstruction(FlagInstructionKind.AddTargetUsers,
            new TargetUser { VariationId = "v1", KeyIds = new[] { "k1" } }).Apply(flag);

        var added = flag.TargetUsers.Single(x => x.VariationId == "v1");
        Assert.Equal(new[] { "k1" }, added.KeyIds);
    }

    [Fact]
    public void TargetUsersInstruction_AddTargetUsers_UnionsKeyIdsForExistingVariation()
    {
        var flag = MakeFlag();
        flag.TargetUsers.Add(new TargetUser { VariationId = "v1", KeyIds = new[] { "k1" } });

        new TargetUsersInstruction(FlagInstructionKind.AddTargetUsers,
            new TargetUser { VariationId = "v1", KeyIds = new[] { "k2" } }).Apply(flag);

        var entry = flag.TargetUsers.Single();
        Assert.Equal(new[] { "k1", "k2" }, entry.KeyIds);
    }

    [Fact]
    public void TargetUsersInstruction_RemoveTargetUsers_RemovesKeyIdsFromMatchingVariation()
    {
        var flag = MakeFlag();
        flag.TargetUsers.Add(new TargetUser { VariationId = "v1", KeyIds = new[] { "k1", "k2" } });

        new TargetUsersInstruction(FlagInstructionKind.RemoveTargetUsers,
            new TargetUser { VariationId = "v1", KeyIds = new[] { "k1" } }).Apply(flag);

        var entry = flag.TargetUsers.Single();
        Assert.Equal(new[] { "k2" }, entry.KeyIds);
    }

    [Fact]
    public void TargetUsersInstruction_SetTargetUsers_ReplacesKeyIdsForExistingVariation()
    {
        var flag = MakeFlag();
        flag.TargetUsers.Add(new TargetUser { VariationId = "v1", KeyIds = new[] { "k1" } });

        new TargetUsersInstruction(FlagInstructionKind.SetTargetUsers,
            new TargetUser { VariationId = "v1", KeyIds = new[] { "k9" } }).Apply(flag);

        var entry = flag.TargetUsers.Single();
        Assert.Equal(new[] { "k9" }, entry.KeyIds);
    }

    [Fact]
    public void AddRuleInstruction_Apply_AppendsRule()
    {
        var flag = MakeFlag();
        var rule = new TargetRule
        {
            Id = "r1", Name = "r1",
            Conditions = new List<Condition>(),
            Variations = new List<RolloutVariation>()
        };

        new AddRuleInstruction(rule).Apply(flag);

        Assert.Contains(flag.Rules, r => r.Id == "r1");
    }

    [Fact]
    public void RemoveRuleInstruction_Apply_RemovesById()
    {
        var flag = MakeFlag();
        flag.Rules.Add(new TargetRule { Id = "r1", Name = "r1", Conditions = new List<Condition>(), Variations = new List<RolloutVariation>() });

        new RemoveRuleInstruction("r1").Apply(flag);

        Assert.Empty(flag.Rules);
    }

    [Fact]
    public void SetRulesInstruction_Apply_ReplacesAllRules()
    {
        var flag = MakeFlag();
        var rules = new List<TargetRule>
        {
            new() { Id = "r1", Name = "r1", Conditions = new List<Condition>(), Variations = new List<RolloutVariation>() }
        };

        new SetRulesInstruction(rules).Apply(flag);

        Assert.Same(rules, flag.Rules);
    }

    [Fact]
    public void RuleNameInstruction_Apply_RenamesMatchingRule()
    {
        var flag = MakeFlag();
        flag.Rules.Add(new TargetRule { Id = "r1", Name = "old", Conditions = new List<Condition>(), Variations = new List<RolloutVariation>() });

        new RuleNameInstruction(new RuleName { RuleId = "r1", Name = "new" }).Apply(flag);

        Assert.Equal("new", flag.Rules.Single().Name);
    }

    [Fact]
    public void RuleDispatchKeyInstruction_Apply_UpdatesMatchingRuleDispatchKey()
    {
        var flag = MakeFlag();
        flag.Rules.Add(new TargetRule { Id = "r1", Name = "r1", DispatchKey = "old", Conditions = new List<Condition>(), Variations = new List<RolloutVariation>() });

        new RuleDispatchKeyInstruction(new RuleDispatchKey { RuleId = "r1", DispatchKey = "new" }).Apply(flag);

        Assert.Equal("new", flag.Rules.Single().DispatchKey);
    }

    [Fact]
    public void UpdateVariationOrRolloutInstruction_Apply_ReplacesRuleVariations()
    {
        var flag = MakeFlag();
        flag.Rules.Add(new TargetRule { Id = "r1", Name = "r1", Conditions = new List<Condition>(), Variations = new List<RolloutVariation>() });
        var newRollouts = new List<RolloutVariation> { new() { Id = "v1", Rollout = new[] { 0.0, 1.0 } } };

        new UpdateVariationOrRolloutInstruction(new RuleVariations { RuleId = "r1", RolloutVariations = newRollouts }).Apply(flag);

        Assert.Same(newRollouts, flag.Rules.Single().Variations);
    }

    [Fact]
    public void RemoveConditionsInstruction_Apply_RemovesNamedConditions()
    {
        var flag = MakeFlag();
        flag.Rules.Add(new TargetRule
        {
            Id = "r1", Name = "r1",
            Conditions = new List<Condition>
            {
                new() { Id = "c1", Property = "p", Op = OperatorTypes.Equal, Value = "a" },
                new() { Id = "c2", Property = "p2", Op = OperatorTypes.Equal, Value = "b" }
            },
            Variations = new List<RolloutVariation>()
        });

        new RemoveConditionsInstruction(new RuleConditionIds { RuleId = "r1", ConditionIds = new[] { "c1" } }).Apply(flag);

        Assert.Single(flag.Rules.Single().Conditions);
        Assert.Equal("c2", flag.Rules.Single().Conditions.Single().Id);
    }

    [Fact]
    public void AddConditionsInstruction_Apply_AppendsConditions()
    {
        var flag = MakeFlag();
        flag.Rules.Add(new TargetRule
        {
            Id = "r1", Name = "r1",
            Conditions = new List<Condition>(),
            Variations = new List<RolloutVariation>()
        });

        new AddConditionsInstruction(new RuleConditions
        {
            RuleId = "r1",
            Conditions = new[]
            {
                new Condition { Id = "c1", Property = "p", Op = OperatorTypes.Equal, Value = "a" }
            }
        }).Apply(flag);

        Assert.Single(flag.Rules.Single().Conditions);
    }

    [Fact]
    public void UpdateConditionInstruction_Apply_AssignsMatchingCondition()
    {
        var flag = MakeFlag();
        flag.Rules.Add(new TargetRule
        {
            Id = "r1", Name = "r1",
            Conditions = new List<Condition>
            {
                new() { Id = "c1", Property = "p", Op = OperatorTypes.Equal, Value = "a" }
            },
            Variations = new List<RolloutVariation>()
        });

        new UpdateConditionInstruction(new RuleCondition
        {
            RuleId = "r1",
            Condition = new Condition { Id = "c1", Property = "p2", Op = OperatorTypes.NotEqual, Value = "b" }
        }).Apply(flag);

        var c = flag.Rules.Single().Conditions.Single();
        Assert.Equal("p2", c.Property);
        Assert.Equal(OperatorTypes.NotEqual, c.Op);
        Assert.Equal("b", c.Value);
    }

    [Fact]
    public void RuleConditionValuesInstruction_AddValues_AppendsToConditionValueList()
    {
        var flag = MakeFlag();
        flag.Rules.Add(new TargetRule
        {
            Id = "r1", Name = "r1",
            Conditions = new List<Condition>
            {
                new() { Id = "c1", Property = "p", Op = OperatorTypes.IsOneOf, Value = "[\"a\"]" }
            },
            Variations = new List<RolloutVariation>()
        });

        new RuleConditionValuesInstruction(FlagInstructionKind.AddValuesToRuleCondition,
            new RuleConditionValues { RuleId = "r1", ConditionId = "c1", Values = new[] { "b" } }).Apply(flag);

        Assert.Equal("[\"a\",\"b\"]", flag.Rules.Single().Conditions.Single().Value);
    }

    [Fact]
    public void RuleConditionValuesInstruction_RemoveValues_RemovesFromConditionValueList()
    {
        var flag = MakeFlag();
        flag.Rules.Add(new TargetRule
        {
            Id = "r1", Name = "r1",
            Conditions = new List<Condition>
            {
                new() { Id = "c1", Property = "p", Op = OperatorTypes.IsOneOf, Value = "[\"a\",\"b\"]" }
            },
            Variations = new List<RolloutVariation>()
        });

        new RuleConditionValuesInstruction(FlagInstructionKind.RemoveValuesFromRuleCondition,
            new RuleConditionValues { RuleId = "r1", ConditionId = "c1", Values = new[] { "a" } }).Apply(flag);

        Assert.Equal("[\"b\"]", flag.Rules.Single().Conditions.Single().Value);
    }

    [Fact]
    public void NoopFlagInstruction_Apply_DoesNotMutateFlag()
    {
        var flag = MakeFlag();

        NoopFlagInstruction.Instance.Apply(flag);

        Assert.Equal("n", flag.Name);
    }
}
