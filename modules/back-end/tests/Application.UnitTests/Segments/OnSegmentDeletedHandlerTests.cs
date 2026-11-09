using Application.Caches;
using Application.Segments;
using Application.Services;
using Domain.Segments;

namespace Application.UnitTests.Segments;

public class OnSegmentDeletedHandlerTests
{
    [Fact]
    public async Task Handle_SegmentDeleted_DeletesFromTheLocalCacheThenPublishesTheDelete()
    {
        var segment = new Segment { Id = Guid.NewGuid(), Key = "segment-key" };
        ICollection<Guid> envIds = [Guid.NewGuid(), Guid.NewGuid()];
        var calls = new List<string>();
        var cache = new Mock<ICacheService>();
        cache.Setup(x => x.DeleteSegmentAsync(envIds, segment.Id))
            .Callback(() => calls.Add("cache"))
            .Returns(Task.CompletedTask);
        var segmentService = new Mock<ISegmentService>();
        segmentService.Setup(x => x.GetEnvironmentIdsAsync(segment)).ReturnsAsync(envIds);
        var publisher = new Mock<ISegmentChangePublisher>();
        publisher.Setup(x => x.PublishDeletedAsync(envIds, segment.Id))
            .Callback(() => calls.Add("publish"))
            .Returns(Task.CompletedTask);
        var sut = new OnSegmentDeletedHandler(
            cache.Object,
            new Mock<IAuditLogService>().Object,
            new Mock<IWebhookHandler>().Object,
            segmentService.Object,
            publisher.Object);
        var notification = new OnSegmentDeleted(segment, Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid());

        await sut.Handle(notification, CancellationToken.None);

        Assert.Equal(["cache", "publish"], calls);
    }
}
