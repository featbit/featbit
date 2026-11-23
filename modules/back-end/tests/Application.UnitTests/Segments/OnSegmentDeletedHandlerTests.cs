using Application.Caches;
using Application.Segments;
using Application.Services;
using Domain.Segments;

namespace Application.UnitTests.Segments;

public class OnSegmentDeletedHandlerTests
{
    /// <summary>
    /// Builds the handler, with a fresh mock for every dependency a test does not pass in.
    /// </summary>
    private static OnSegmentDeletedHandler CreateSut(
        Mock<ICacheService>? cache = null,
        Mock<IWebhookHandler>? webhookHandler = null,
        Mock<ISegmentService>? segmentService = null,
        Mock<ISegmentChangePublisher>? publisher = null) =>
        new(
            (cache ?? new()).Object,
            Mock.Of<IAuditLogService>(),
            (webhookHandler ?? new()).Object,
            (segmentService ?? new()).Object,
            (publisher ?? new()).Object);

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
        var sut = CreateSut(cache: cache, segmentService: segmentService, publisher: publisher);
        var notification = new OnSegmentDeleted(segment, Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid());

        await sut.Handle(notification, CancellationToken.None);

        Assert.Equal(["cache", "publish"], calls);
    }

    /// <summary>
    /// A failure to publish the delete still reaches the caller, but only after the webhooks of every environment
    /// the segment belongs to have been dispatched.
    /// </summary>
    [Fact]
    public async Task Handle_PublishFails_StillDispatchesTheWebhooksAndRethrows()
    {
        var segment = new Segment { Id = Guid.NewGuid(), Key = "segment-key" };
        ICollection<Guid> envIds = [Guid.NewGuid(), Guid.NewGuid()];
        var webhookHandler = new Mock<IWebhookHandler>();
        var segmentService = new Mock<ISegmentService>();
        segmentService.Setup(x => x.GetEnvironmentIdsAsync(segment)).ReturnsAsync(envIds);
        var publisher = new Mock<ISegmentChangePublisher>();
        publisher.Setup(x => x.PublishDeletedAsync(envIds, segment.Id))
            .ThrowsAsync(new InvalidOperationException("broker down"));
        var sut = CreateSut(webhookHandler: webhookHandler, segmentService: segmentService, publisher: publisher);
        var notification = new OnSegmentDeleted(segment, Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid());

        await Assert.ThrowsAsync<InvalidOperationException>(() => sut.Handle(notification, CancellationToken.None));

        foreach (var envId in envIds)
        {
            webhookHandler.Verify(
                x => x.HandleAsync(envId, segment, notification.DataChange, notification.OperatorId), Times.Once);
        }
    }
}
