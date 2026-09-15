using System.Text.Json;
using Domain.EndUsers;
using Domain.Evaluation;
using Domain.Insights;

namespace Domain.UnitTests.Insights;

public class InsightMessageTests
{
    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public void Serialize_IncludesNumericSchemaVersion(bool exposure)
    {
        var user = new EndUser { KeyId = "user", Name = "User" };
        var envId = Guid.NewGuid().ToString();
        var message = exposure
            ? InsightMessage.ForFlagValue(envId, user, new VariationInsight
            {
                FeatureFlagKey = "flag",
                Variation = new Variation("variation", "true")
            })
            : InsightMessage.ForMetric(envId, user, new MetricInsight
            {
                Type = "Custom",
                EventName = "purchase"
            });

        using var json = JsonDocument.Parse(JsonSerializer.Serialize(message));

        Assert.Equal(2, json.RootElement.GetProperty("schema_version").GetInt32());
    }
}
