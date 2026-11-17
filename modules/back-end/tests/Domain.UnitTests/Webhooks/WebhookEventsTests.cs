using Domain.SemanticPatch;
using Domain.Webhooks;

namespace Domain.UnitTests.Webhooks;

public class WebhookEventsTests
{
    [Theory]
    [InlineData("")]
    [InlineData(null)]
    [InlineData("unknown")]
    [InlineData(FlagInstructionKind.Noop)]
    public void UnknownKind_ReturnsEmpty(string? kind)
    {
        Assert.Equal(string.Empty, WebhookEvents.FlagEvents.FromInstructionKind(kind));
        Assert.Equal(string.Empty, WebhookEvents.SegmentEvents.FromInstructionKind(kind));
    }

    [Fact]
    public void FlagKind_HaveMappedWebhookEvents()
    {
        var kinds = FlagInstructionKind.All.Where(kind => kind != FlagInstructionKind.Noop);

        foreach (var kind in kinds)
        {
            var eventName = WebhookEvents.FlagEvents.FromInstructionKind(kind);

            Assert.False(
                string.IsNullOrWhiteSpace(eventName),
                $"Missing webhook event for flag instruction '{kind}'."
            );
        }
    }

    [Fact]
    public void SegmentKind_HaveMappedWebhookEvents()
    {
        var kinds = SegmentInstructionKind.All.Where(kind => kind != SegmentInstructionKind.Noop);

        foreach (var kind in kinds)
        {
            var eventName = WebhookEvents.SegmentEvents.FromInstructionKind(kind);

            Assert.False(
                string.IsNullOrWhiteSpace(eventName),
                $"Missing webhook event for segment instruction '{kind}'."
            );
        }
    }
}
