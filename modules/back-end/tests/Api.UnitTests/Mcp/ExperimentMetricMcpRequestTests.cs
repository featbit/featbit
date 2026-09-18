using Api.Mcp;

namespace Api.UnitTests.Mcp;

public class ExperimentMetricMcpRequestTests
{
    [Fact]
    public void CreateAndUpdate_ForwardSdkEventNameIndependentlyOfMetricKey()
    {
        var create = new ExperimentMcpMetricCreateRequest
        {
            Name = "Purchase conversion", Key = "purchase_conversion", EventName = "purchase"
        }.ToCreateRequest();
        var update = new ExperimentMcpMetricUpdateRequest
        {
            Name = "Purchase conversion", EventName = "purchase_completed"
        }.ToUpdateRequest();

        Assert.Equal("purchase_conversion", create.Key);
        Assert.Equal("purchase", create.EventName);
        Assert.Equal("purchase_completed", update.EventName);
    }
}
