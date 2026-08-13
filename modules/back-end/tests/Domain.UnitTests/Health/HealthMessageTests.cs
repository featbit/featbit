using System.Text.Json;
using Domain.ControlPlane;

namespace Domain.UnitTests.Health;

public class HealthMessageTests
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true
    };

    [Fact]
    public void Deserialize_OldFormatJson_WithoutNewFields_Succeeds()
    {
        const string json = "{\"podId\":\"p1\",\"timestamp\":\"2026-01-01T00:00:00Z\"}";

        var message = JsonSerializer.Deserialize<HealthMessage>(json, JsonOptions);

        Assert.NotNull(message);
        Assert.Equal("p1", message!.PodId);
        Assert.Equal(DateTimeOffset.Parse("2026-01-01T00:00:00Z"), message.Timestamp);
        Assert.Null(message.Region);
        Assert.Null(message.DcId);
        Assert.Null(message.AppliedWatermarks);
    }

    [Fact]
    public void Deserialize_NewFormatJson_PopulatesNewFields()
    {
        var resourceId = Guid.Parse("11111111-1111-1111-1111-111111111111");
        var json =
            "{\"podId\":\"p2\",\"timestamp\":\"2026-01-01T00:00:00Z\"," +
            "\"region\":\"us-east\",\"dcId\":\"dc-1\"," +
            $"\"appliedWatermarks\":{{\"{resourceId}\":42}}}}";

        var message = JsonSerializer.Deserialize<HealthMessage>(json, JsonOptions);

        Assert.NotNull(message);
        Assert.Equal("p2", message!.PodId);
        Assert.Equal("us-east", message.Region);
        Assert.Equal("dc-1", message.DcId);
        Assert.NotNull(message.AppliedWatermarks);
        Assert.Equal(42, message.AppliedWatermarks![resourceId]);
    }
}
