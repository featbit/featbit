using System.Text.Json;
using Domain.EndUsers;
using Domain.FeatureFlags;
using Domain.Segments;
using Domain.Targeting;

namespace Domain.UnitTests.FeatureFlags;

public class FlagCopyHelperTests
{
    private const string TargetEnvRn = "account/acc:project/proj:env/target";

    private static Segment Segment(string id, string type = SegmentType.Shared, string[]? scopes = null) => new(
        workspaceId: Guid.NewGuid(),
        envId: Guid.NewGuid(),
        name: "n", key: "k",
        type: type,
        scopes: scopes ?? new[] { "account/acc:project/proj:env/*" },
        included: Array.Empty<string>(),
        excluded: Array.Empty<string>(),
        rules: Array.Empty<MatchRule>(),
        description: "d")
    { Id = Guid.Parse(id) };

    private static Condition SegmentCondition(params Guid[] segmentIds) => new()
    {
        Id = Guid.NewGuid().ToString(),
        Property = SegmentConsts.IsInSegment,
        Op = "x",
        Value = JsonSerializer.Serialize(segmentIds.Select(g => g.ToString()).ToArray())
    };

    private static Condition StringCondition(string property, string value) => new()
    {
        Id = Guid.NewGuid().ToString(), Property = property,
        Op = OperatorTypes.Equal, Value = value
    };

    [Fact]
    public void IsRulesCopyable_NoRules_ReturnsTrue()
    {
        Assert.True(FlagCopyHelper.IsRulesCopyable(Array.Empty<TargetRule>(), Array.Empty<Segment>(), TargetEnvRn));
    }

    [Fact]
    public void IsRulesCopyable_NoSegmentConditions_ReturnsTrue()
    {
        var rules = new[]
        {
            new TargetRule { Id = "r1", Name = "n", Conditions = new[] { StringCondition("country", "US") }, Variations = new List<RolloutVariation>() }
        };

        Assert.True(FlagCopyHelper.IsRulesCopyable(rules, Array.Empty<Segment>(), TargetEnvRn));
    }

    [Fact]
    public void IsRulesCopyable_EnvironmentSpecificSegment_ReturnsFalse()
    {
        var segmentId = Guid.NewGuid();
        var segment = Segment(segmentId.ToString(), type: SegmentType.EnvironmentSpecific);
        var rules = new[]
        {
            new TargetRule { Id = "r1", Name = "n", Conditions = new[] { SegmentCondition(segmentId) }, Variations = new List<RolloutVariation>() }
        };

        Assert.False(FlagCopyHelper.IsRulesCopyable(rules, new[] { segment }, TargetEnvRn));
    }

    [Fact]
    public void IsRulesCopyable_SharedSegmentNotInTargetScope_ReturnsFalse()
    {
        var segmentId = Guid.NewGuid();
        var segment = Segment(segmentId.ToString(), scopes: new[] { "account/acc:project/proj:env/other" });
        var rules = new[]
        {
            new TargetRule { Id = "r1", Name = "n", Conditions = new[] { SegmentCondition(segmentId) }, Variations = new List<RolloutVariation>() }
        };

        Assert.False(FlagCopyHelper.IsRulesCopyable(rules, new[] { segment }, TargetEnvRn));
    }

    [Fact]
    public void IsRulesCopyable_SharedSegmentInTargetScope_ReturnsTrue()
    {
        var segmentId = Guid.NewGuid();
        var segment = Segment(segmentId.ToString(), scopes: new[] { "account/acc:project/proj" });
        var rules = new[]
        {
            new TargetRule { Id = "r1", Name = "n", Conditions = new[] { SegmentCondition(segmentId) }, Variations = new List<RolloutVariation>() }
        };

        Assert.True(FlagCopyHelper.IsRulesCopyable(rules, new[] { segment }, TargetEnvRn));
    }

    [Fact]
    public void GetNewProperties_NoRules_ReturnsEmpty()
    {
        var result = FlagCopyHelper.GetNewProperties(Array.Empty<TargetRule>(), Array.Empty<EndUserProperty>());

        Assert.Empty(result);
    }

    [Fact]
    public void GetNewProperties_OnlySegmentConditions_ReturnsEmpty()
    {
        var rules = new[]
        {
            new TargetRule { Id = "r1", Name = "n", Conditions = new[] { SegmentCondition(Guid.NewGuid()) }, Variations = new List<RolloutVariation>() }
        };

        var result = FlagCopyHelper.GetNewProperties(rules, Array.Empty<EndUserProperty>());

        Assert.Empty(result);
    }

    [Fact]
    public void GetNewProperties_RulesReferenceUnknownProperties_ReturnsThoseProperties()
    {
        var rules = new[]
        {
            new TargetRule
            {
                Id = "r1", Name = "n",
                Conditions = new[] { StringCondition("country", "US"), StringCondition("plan", "free") },
                Variations = new List<RolloutVariation>()
            }
        };
        var known = new[] { new EndUserProperty(Guid.NewGuid(), "country") };

        var result = FlagCopyHelper.GetNewProperties(rules, known);

        Assert.Equal(new[] { "plan" }, result);
    }

    [Fact]
    public void CopySettings_OnOffStateTrue_CopiesIsEnabled()
    {
        var source = MakeSource(isEnabled: true);
        var target = MakeTarget(isEnabled: false);

        FlagCopyHelper.CopySettings(new FlagCopyContext(source, target, Array.Empty<Segment>(),
            new FlagSettingCopyOptions(
                OnOffState: true,
                IndividualTargeting: new CopyIndividualTargetingOption(false, CopyModes.Overwrite),
                TargetingRule: new CopyTargetingRuleOption(false, CopyModes.Overwrite),
                DefaultRule: false,
                OffVariation: false)));

        Assert.True(target.IsEnabled);
    }

    [Fact]
    public void CopySettings_MissingSourceVariation_GetsAppendedToTarget()
    {
        var source = MakeSource();
        source.Variations.Add(new Variation { Id = "src-only", Name = "Extra", Value = "extra-val" });
        var target = MakeTarget();

        FlagCopyHelper.CopySettings(new FlagCopyContext(source, target, Array.Empty<Segment>(),
            new FlagSettingCopyOptions(
                OnOffState: false,
                IndividualTargeting: new CopyIndividualTargetingOption(false, CopyModes.Overwrite),
                TargetingRule: new CopyTargetingRuleOption(false, CopyModes.Overwrite),
                DefaultRule: false,
                OffVariation: false)));

        Assert.Contains(target.Variations, v => v.Value == "extra-val");
    }

    [Fact]
    public void CopySettings_IndividualTargetingOverwrite_ReplacesTargetUserKeys()
    {
        var source = MakeSource();
        source.TargetUsers = new List<TargetUser>
        {
            new() { VariationId = "s1", KeyIds = new[] { "src-key" } }
        };
        var target = MakeTarget();
        target.TargetUsers = new List<TargetUser>
        {
            new() { VariationId = "t1", KeyIds = new[] { "old-target-key" } }
        };

        FlagCopyHelper.CopySettings(new FlagCopyContext(source, target, Array.Empty<Segment>(),
            new FlagSettingCopyOptions(
                OnOffState: false,
                IndividualTargeting: new CopyIndividualTargetingOption(true, CopyModes.Overwrite),
                TargetingRule: new CopyTargetingRuleOption(false, CopyModes.Overwrite),
                DefaultRule: false,
                OffVariation: false)));

        // each target variation gets a TargetUser entry (some may be empty because no matching source variation by value)
        var matched = target.TargetUsers.Single(tu => tu.VariationId == "t1");
        Assert.Equal(new[] { "src-key" }, matched.KeyIds);
    }

    [Fact]
    public void CopySettings_OffVariation_MapsByValueToTargetVariationId()
    {
        var source = MakeSource();
        source.DisabledVariationId = "s2"; // s2 has Value="val2"
        var target = MakeTarget();

        FlagCopyHelper.CopySettings(new FlagCopyContext(source, target, Array.Empty<Segment>(),
            new FlagSettingCopyOptions(
                OnOffState: false,
                IndividualTargeting: new CopyIndividualTargetingOption(false, CopyModes.Overwrite),
                TargetingRule: new CopyTargetingRuleOption(false, CopyModes.Overwrite),
                DefaultRule: false,
                OffVariation: true)));

        Assert.Equal("t2", target.DisabledVariationId);
    }

    [Fact]
    public void CopySettings_DefaultRule_CopiesFallthroughAndRemapsVariationIds()
    {
        var source = MakeSource();
        source.Fallthrough.Variations = new List<RolloutVariation>
        {
            new() { Id = "s1", Rollout = new[] { 0.0, 1.0 } }
        };
        var target = MakeTarget();

        FlagCopyHelper.CopySettings(new FlagCopyContext(source, target, Array.Empty<Segment>(),
            new FlagSettingCopyOptions(
                OnOffState: false,
                IndividualTargeting: new CopyIndividualTargetingOption(false, CopyModes.Overwrite),
                TargetingRule: new CopyTargetingRuleOption(false, CopyModes.Overwrite),
                DefaultRule: true,
                OffVariation: false)));

        var rollout = target.Fallthrough.Variations.Single();
        // source variation s1 had Value=val1, target variation t1 has Value=val1
        Assert.Equal("t1", rollout.Id);
    }

    private static FeatureFlag MakeSource(bool isEnabled = false) => MakeFlag(
        isEnabled, ("s1", "val1"), ("s2", "val2"));

    private static FeatureFlag MakeTarget(bool isEnabled = false) => MakeFlag(
        isEnabled, ("t1", "val1"), ("t2", "val2"));

    private static FeatureFlag MakeFlag(bool isEnabled, params (string id, string value)[] variations) => new()
    {
        Name = "n",
        Description = "d",
        IsEnabled = isEnabled,
        Tags = Array.Empty<string>(),
        VariationType = VariationTypes.String,
        Variations = variations.Select(v => new Variation { Id = v.id, Name = v.id, Value = v.value }).ToList<Variation>(),
        DisabledVariationId = variations[0].id,
        Fallthrough = new Fallthrough
        {
            DispatchKey = "k",
            Variations = new List<RolloutVariation> { new() { Id = variations[0].id, Rollout = new[] { 0.0, 1.0 } } }
        },
        TargetUsers = new List<TargetUser>(),
        Rules = new List<TargetRule>()
    };
}
