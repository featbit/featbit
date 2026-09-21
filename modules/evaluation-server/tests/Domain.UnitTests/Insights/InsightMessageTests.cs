using System.Text.Json;
using System.Text.Json.Nodes;
using Domain.EndUsers;
using Domain.Evaluation;
using Domain.Insights;

namespace Domain.UnitTests.Insights;

public class InsightMessageTests
{
    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public void Serialize_ProducesExpectedMessageContract(bool exposure)
    {
        const string envId = "22222222-2222-2222-2222-222222222222";
        const long timestampMs = 1767225600123L;
        var user = new EndUser { KeyId = "user", Name = "User" };
        var message = exposure
            ? InsightMessage.ForFlagValue(envId, user, new VariationInsight
            {
                FeatureFlagKey = "flag",
                Variation = new Variation("variation", "true"),
                Timestamp = timestampMs
            })
            : InsightMessage.ForMetric(envId, user, new MetricInsight
            {
                Type = "Custom",
                EventName = "purchase",
                NumericValue = 1.23456789012345,
                AppType = "dotnet-server-side",
                Timestamp = timestampMs
            });

        using var json = JsonDocument.Parse(JsonSerializer.Serialize(message));
        var root = json.RootElement;
        Assert.True(Guid.TryParse(root.GetProperty("uuid").GetString(), out _));
        Assert.Equal(envId, root.GetProperty("env_id").GetString());
        Assert.Equal(exposure ? "FlagValue" : "Custom", root.GetProperty("event").GetString());
        Assert.Equal(timestampMs * 1000, root.GetProperty("timestamp").GetInt64());
        Assert.Equal(JsonValueKind.String, root.GetProperty("properties").ValueKind);
        Assert.Equal(5, root.EnumerateObject().Count());

        var expected = exposure
            ? new JsonObject
            {
                ["featureFlagKey"] = "flag",
                ["userKeyId"] = "user", 
                ["userName"] = "User",
                ["variationId"] = "variation",
                ["variationValue"] = "true"
            }
            : new JsonObject
            {
                ["eventName"] = "purchase", 
                ["numericValue"] = 1.23456789012345,
                ["user"] = new JsonObject { ["keyId"] = "user", ["name"] = "User" },
                ["applicationType"] = "dotnet-server-side"
            };
        Assert.True(JsonNode.DeepEquals(expected, JsonNode.Parse(root.GetProperty("properties").GetString()!)));
    }
}
