using Application.Bases.Exceptions;
using Application.FeatureFlags;
using Application.Policies;
using Application.Services;
using Application.Users;
using Domain.FeatureFlags;
using Domain.Policies;
using Domain.Resources;
using MediatR;

namespace Application.UnitTests.Handlers;

public class UpdateTargetingHandlerTests
{
    private static FeatureFlag NewFlag()
    {
        var on = new Variation { Id = "v-on", Name = "On", Value = "true" };
        var off = new Variation { Id = "v-off", Name = "Off", Value = "false" };
        return new FeatureFlag(
            envId: Guid.NewGuid(),
            name: "Flag",
            description: "desc",
            key: "flag",
            isEnabled: true,
            variationType: VariationTypes.Boolean,
            variations: new[] { on, off },
            disabledVariationId: off.Id,
            enabledVariationId: on.Id,
            tags: Array.Empty<string>(),
            currentUserId: Guid.NewGuid());
    }

    private static FlagTargeting NewTargeting(FeatureFlag flag, string disabledVariationId) => new()
    {
        DisabledVariationId = disabledVariationId,
        TargetUsers = flag.TargetUsers,
        Rules = flag.Rules,
        Fallthrough = flag.Fallthrough,
        ExptIncludeAllTargets = flag.ExptIncludeAllTargets
    };

    private static PolicyStatement[] Allow(string action) =>
    [
        new PolicyStatement
        {
            ResourceType = ResourceTypes.FeatureFlag,
            Effect = EffectType.Allow,
            Actions = new[] { action },
            Resources = new[] { "*" }
        }
    ];

    private static UpdateTargetingHandler BuildSut(
        FeatureFlag flag,
        Mock<IFeatureFlagService> flagService,
        Mock<IResourceService> resourceService,
        Mock<IPublisher> publisher)
    {
        flagService.Setup(x => x.GetAsync(flag.EnvId, flag.Key)).ReturnsAsync(flag);
        resourceService.Setup(x => x.GetFlagRnAsync(flag.EnvId, flag.Key)).ReturnsAsync("flag/*");

        var currentUser = new Mock<ICurrentUser>();
        currentUser.SetupGet(x => x.Id).Returns(Guid.NewGuid());

        return new UpdateTargetingHandler(
            flagService.Object,
            new PermissionGuard(resourceService.Object),
            currentUser.Object,
            publisher.Object);
    }

    private static UpdateTargeting NewRequest(
        FeatureFlag flag,
        string disabledVariationId,
        PolicyStatement[] permissions) =>
        new(
            Guid.NewGuid(),
            flag.EnvId,
            flag.Key,
            new UpdateTargetingPayload
            {
                Revision = flag.Revision,
                Targeting = NewTargeting(flag, disabledVariationId)
            },
            permissions);

    [Fact]
    public async Task Handle_OffVariationChangedWithoutPermission_ThrowsForbidden()
    {
        var flag = NewFlag();
        var flagService = new Mock<IFeatureFlagService>();
        var resourceService = new Mock<IResourceService>();
        var publisher = new Mock<IPublisher>();
        var sut = BuildSut(flag, flagService, resourceService, publisher);
        var request = NewRequest(
            flag,
            "v-on",
            Allow(Permissions.UpdateFlagDefaultRule));

        await Assert.ThrowsAsync<ForbiddenException>(
            () => sut.Handle(request, CancellationToken.None));

        flagService.Verify(x => x.UpdateAsync(It.IsAny<FeatureFlag>()), Times.Never);
        publisher.Verify(
            x => x.Publish(It.IsAny<OnFeatureFlagChanged>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }

    [Fact]
    public async Task Handle_OffVariationChangedWithPermission_UpdatesAndPublishes()
    {
        var flag = NewFlag();
        var flagService = new Mock<IFeatureFlagService>();
        var resourceService = new Mock<IResourceService>();
        var publisher = new Mock<IPublisher>();
        var sut = BuildSut(flag, flagService, resourceService, publisher);
        var request = NewRequest(
            flag,
            "v-on",
            Allow(Permissions.UpdateFlagOffVariation));

        await sut.Handle(request, CancellationToken.None);

        Assert.Equal("v-on", flag.DisabledVariationId);
        flagService.Verify(x => x.UpdateAsync(flag), Times.Once);
        publisher.Verify(
            x => x.Publish(It.IsAny<OnFeatureFlagChanged>(), It.IsAny<CancellationToken>()),
            Times.Once);
    }
}
