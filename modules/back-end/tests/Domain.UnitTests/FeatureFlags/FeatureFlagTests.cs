using System.Text.Json;
using Domain.FeatureFlags;
using Domain.Utils;

namespace Domain.UnitTests.FeatureFlags;

public class FeatureFlagTests
{
    [Fact]
    public void Serialize_InternalMongoToken_IsAbsentFromPublicFlagJson()
    {
        var flag = NewFlag();
        flag.MongoETag = Guid.NewGuid();

        var json = JsonSerializer.SerializeToNode(flag, ReusableJsonSerializerOptions.Web)!.AsObject();

        Assert.False(json.ContainsKey("mongoETag"));
    }

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
}
