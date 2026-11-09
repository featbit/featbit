using Application.Caches;
using Application.FeatureFlags;
using Application.Services;
using Domain.FeatureFlags;

namespace Application.UnitTests.FeatureFlags;

public class OnFeatureFlagDeletedHandlerTests
{
    /// <summary>
    /// Builds the handler, with a fresh mock for every dependency a test does not pass in.
    /// </summary>
    private static OnFeatureFlagDeletedHandler CreateSut(
        Mock<ICacheService>? cache = null,
        Mock<IWebhookHandler>? webhookHandler = null,
        Mock<IFeatureFlagChangePublisher>? publisher = null) =>
        new(
            (cache ?? new()).Object,
            Mock.Of<IAuditLogService>(),
            (webhookHandler ?? new()).Object,
            (publisher ?? new()).Object);

    [Fact]
    public async Task Handle_FlagDeleted_DeletesFromTheLocalCacheThenPublishesTheDelete()
    {
        var flag = new FeatureFlag { Id = Guid.NewGuid(), EnvId = Guid.NewGuid(), Key = "flag-key" };
        var calls = new List<string>();
        var cache = new Mock<ICacheService>();
        cache.Setup(x => x.DeleteFlagAsync(flag.EnvId, flag.Id))
            .Callback(() => calls.Add("cache"))
            .Returns(Task.CompletedTask);
        var publisher = new Mock<IFeatureFlagChangePublisher>();
        publisher.Setup(x => x.PublishDeletedAsync(flag.EnvId, flag.Id))
            .Callback(() => calls.Add("publish"))
            .Returns(Task.CompletedTask);
        var sut = CreateSut(cache: cache, publisher: publisher);
        var notification = new OnFeatureFlagDeleted(flag, Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid());

        await sut.Handle(notification, CancellationToken.None);

        Assert.Equal(["cache", "publish"], calls);
    }

    [Fact]
    public async Task Handle_PublishFails_StillDispatchesTheWebhookAndRethrows()
    {
        var flag = new FeatureFlag { Id = Guid.NewGuid(), EnvId = Guid.NewGuid(), Key = "flag-key" };
        var webhookHandler = new Mock<IWebhookHandler>();
        var publisher = new Mock<IFeatureFlagChangePublisher>();
        publisher.Setup(x => x.PublishDeletedAsync(flag.EnvId, flag.Id))
            .ThrowsAsync(new InvalidOperationException("broker down"));
        var sut = CreateSut(webhookHandler: webhookHandler, publisher: publisher);
        var notification = new OnFeatureFlagDeleted(flag, Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid());

        await Assert.ThrowsAsync<InvalidOperationException>(() => sut.Handle(notification, CancellationToken.None));

        webhookHandler.Verify(
            x => x.HandleAsync(flag, notification.DataChange, notification.OperatorId), Times.Once);
    }
}
