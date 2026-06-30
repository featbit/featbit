using Application.Bases.Exceptions;
using Application.FeatureFlags;
using Application.Services;
using Application.Users;
using Domain.FeatureFlags;
using MediatR;

namespace Application.UnitTests.Handlers;

public class UpdateOffVariationHandlerTests
{
    private static FeatureFlag NewFlag()
    {
        var on = new Variation { Id = "v-on", Name = "On", Value = "true" };
        var off = new Variation { Id = "v-off", Name = "Off", Value = "false" };
        return new FeatureFlag(
            envId: Guid.NewGuid(),
            name: "Flag",
            description: null,
            key: "flag",
            isEnabled: true,
            variationType: VariationTypes.Boolean,
            variations: new[] { on, off },
            disabledVariationId: off.Id,
            enabledVariationId: on.Id,
            tags: Array.Empty<string>(),
            currentUserId: Guid.NewGuid());
    }

    [Fact]
    public async Task Handle_RevisionMismatch_ThrowsConflictException()
    {
        var flag = NewFlag();
        var service = new Mock<IFeatureFlagService>();
        service.Setup(x => x.GetAsync(It.IsAny<Guid>(), It.IsAny<string>())).ReturnsAsync(flag);
        var currentUser = new Mock<ICurrentUser>();
        var publisher = new Mock<IPublisher>();
        var sut = new UpdateOffVariationHandler(service.Object, currentUser.Object, publisher.Object);
        var request = new UpdateOffVariation { Revision = Guid.NewGuid(), OffVariationId = "v-on" };

        await Assert.ThrowsAsync<ConflictException>(() => sut.Handle(request, CancellationToken.None));

        service.Verify(x => x.UpdateAsync(It.IsAny<FeatureFlag>()), Times.Never);
    }

    [Fact]
    public async Task Handle_RevisionMatches_UpdatesAndPublishes()
    {
        var flag = NewFlag();
        var service = new Mock<IFeatureFlagService>();
        service.Setup(x => x.GetAsync(It.IsAny<Guid>(), It.IsAny<string>())).ReturnsAsync(flag);
        var currentUser = new Mock<ICurrentUser>();
        currentUser.SetupGet(x => x.Id).Returns(Guid.NewGuid());
        var publisher = new Mock<IPublisher>();
        var sut = new UpdateOffVariationHandler(service.Object, currentUser.Object, publisher.Object);
        var request = new UpdateOffVariation { Revision = flag.Revision, OffVariationId = "v-on" };

        var newRevision = await sut.Handle(request, CancellationToken.None);

        Assert.NotEqual(Guid.Empty, newRevision);
        service.Verify(x => x.UpdateAsync(flag), Times.Once);
        publisher.Verify(x => x.Publish(It.IsAny<OnFeatureFlagChanged>(), It.IsAny<CancellationToken>()), Times.Once);
    }
}
