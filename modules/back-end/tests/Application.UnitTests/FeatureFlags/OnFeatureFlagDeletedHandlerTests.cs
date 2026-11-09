using Application.Caches;
using Application.FeatureFlags;
using Application.Services;
using Domain.FeatureFlags;

namespace Application.UnitTests.FeatureFlags;

public class OnFeatureFlagDeletedHandlerTests
{
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
        var sut = new OnFeatureFlagDeletedHandler(
            cache.Object,
            new Mock<IAuditLogService>().Object,
            new Mock<IWebhookHandler>().Object,
            publisher.Object);
        var notification = new OnFeatureFlagDeleted(flag, Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid());

        await sut.Handle(notification, CancellationToken.None);

        Assert.Equal(["cache", "publish"], calls);
    }
}
