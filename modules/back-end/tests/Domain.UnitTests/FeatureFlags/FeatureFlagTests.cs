using System.Text.Json;
using Domain.FeatureFlags;
using Domain.Utils;

namespace Domain.UnitTests.FeatureFlags;

public class FeatureFlagTests
{
    private static FeatureFlag NewFlag()
    {
        var on = new Variation { Id = "v-on", Name = "On", Value = "true" };
        var off = new Variation { Id = "v-off", Name = "Off", Value = "false" };
        return new FeatureFlag(
            envId: Guid.NewGuid(),
            name: "Flag",
            description: "desc",
            key: "flag",
            isEnabled: true,
            variationType: VariationTypes.Boolean,
            variations: [on, off],
            disabledVariationId: off.Id,
            enabledVariationId: on.Id,
            tags: [],
            currentUserId: Guid.NewGuid());
    }

    [Fact]
    public void Constructor_NewFlag_HasInsightsEnabled()
    {
        var flag = NewFlag();

        Assert.True(flag.InsightsEnabled);
    }

    [Fact]
    public void Deserialize_JsonWithoutInsightsEnabled_DefaultsToEnabled()
    {
        var node = JsonSerializer.SerializeToNode(NewFlag(), ReusableJsonSerializerOptions.Web)!.AsObject();
        node.Remove("insightsEnabled");

        var flag = node.Deserialize<FeatureFlag>(ReusableJsonSerializerOptions.Web)!;

        Assert.True(flag.InsightsEnabled);
    }

    [Fact]
    public void PromotePending_PendingDisablesInsights_CopiesInsightsEnabled()
    {
        var flag = NewFlag();
        var pending = flag.Clone();
        pending.InsightsEnabled = false;
        flag.SetPending(pending, 2);

        flag.PromotePending();

        Assert.False(flag.InsightsEnabled);
    }

    [Fact]
    public void Clone_InsightsDisabled_PreservesValue()
    {
        var flag = NewFlag();
        flag.InsightsEnabled = false;

        var clone = flag.Clone();

        Assert.False(clone.InsightsEnabled);
    }

    [Fact]
    public void CopyToEnv_InsightsDisabled_PreservesValue()
    {
        var flag = NewFlag();
        flag.InsightsEnabled = false;

        flag.CopyToEnv(Guid.NewGuid(), Guid.NewGuid());

        Assert.False(flag.InsightsEnabled);
    }
}
