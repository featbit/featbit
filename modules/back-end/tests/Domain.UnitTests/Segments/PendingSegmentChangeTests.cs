using System.Text.Json;
using Domain.AuditLogs;
using Domain.Segments;
using Domain.Utils;

namespace Domain.UnitTests.Segments;

public class PendingSegmentChangeTests
{
    [Fact]
    public void Deserialize_LegacyJson_Without_AttributionFields_Uses_Defaults()
    {
        // #73a: a pending row staged before OperatorId/Operation/IsTargetingChange existed must
        // deserialize to exactly the values the coordinator used to hardcode at commit time
        // (Guid.Empty / Operations.Update / true).
        const string legacyJson = """
                                   {
                                     "version": 2,
                                     "value": null
                                   }
                                   """;

        var pending = JsonSerializer.Deserialize<PendingSegmentChange>(
            legacyJson, ReusableJsonSerializerOptions.Web);

        Assert.NotNull(pending);
        Assert.Equal(2, pending!.Version);
        Assert.Equal(Guid.Empty, pending.OperatorId);
        Assert.Equal(Operations.Update, pending.Operation);
        Assert.True(pending.IsTargetingChange);
    }
}
