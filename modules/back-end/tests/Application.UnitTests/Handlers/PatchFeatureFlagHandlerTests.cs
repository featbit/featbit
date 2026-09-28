using Application.Bases.Exceptions;
using Application.Experiments;
using Application.FeatureFlags;
using Application.Policies;
using Application.Services;
using Application.Users;
using Domain.AuditLogs;
using Domain.FeatureFlags;
using Domain.Policies;
using Domain.Resources;
using MediatR;
using Microsoft.AspNetCore.JsonPatch.SystemTextJson;
using Microsoft.AspNetCore.JsonPatch.SystemTextJson.Operations;

namespace Application.UnitTests.Handlers;

public class PatchFeatureFlagHandlerTests
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

    private static PolicyStatement[] AllowAll() =>
    [
        new PolicyStatement
        {
            Effect = EffectType.Allow,
            Actions = new[] { "*" },
            Resources = new[] { "*" }
        }
    ];

    [Fact]
    public async Task Handle_ValidPatch_AppliesUpdatesAndPublishes()
    {
        var flag = NewFlag();
        var service = new Mock<IFeatureFlagService>();
        service.Setup(x => x.GetAsync(It.IsAny<Guid>(), It.IsAny<string>())).ReturnsAsync(flag);
        var currentUser = new Mock<ICurrentUser>();
        var operatorId = Guid.NewGuid();
        currentUser.SetupGet(x => x.Id).Returns(operatorId);
        var publisher = new Mock<IPublisher>();
        var resourceService = new Mock<IResourceService>();
        resourceService.Setup(x => x.GetFlagRnAsync(It.IsAny<Guid>(), It.IsAny<string>())).ReturnsAsync("flag/*");
        var sut = new PatchFeatureFlagHandler(service.Object, new PermissionGuard(resourceService.Object), currentUser.Object, Mock.Of<IFlagInsightsGuard>(), publisher.Object);

        var patch = new JsonPatchDocument<FeatureFlag>();
        patch.Replace(x => x.Description, "patched");
        var request = new PatchFeatureFlag { EnvId = Guid.NewGuid(), Key = "flag", Patch = patch, Permissions = AllowAll() };

        var result = await sut.Handle(request, CancellationToken.None);

        Assert.True(result.Success);
        Assert.Equal("patched", flag.Description);
        Assert.Equal(operatorId, flag.UpdatorId);
        service.Verify(x => x.UpdateAsync(flag), Times.Once);
        publisher.Verify(x => x.Publish(
            It.Is<OnFeatureFlagChanged>(n =>
                n.Operation == Operations.Update &&
                n.Flag == flag &&
                n.OperatorId == operatorId &&
                n.DataChange != null),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Handle_InvalidPatchPath_ReturnsFailureWithoutPersisting()
    {
        var flag = NewFlag();
        var service = new Mock<IFeatureFlagService>();
        service.Setup(x => x.GetAsync(It.IsAny<Guid>(), It.IsAny<string>())).ReturnsAsync(flag);
        var publisher = new Mock<IPublisher>();
        var sut = new PatchFeatureFlagHandler(service.Object, new PermissionGuard(Mock.Of<IResourceService>()), Mock.Of<ICurrentUser>(), Mock.Of<IFlagInsightsGuard>(), publisher.Object);

        // op against a non-existent path produces a JsonPatchError when applied
        var patch = new JsonPatchDocument<FeatureFlag>();
        patch.Operations.Add(new Operation<FeatureFlag>
        {
            op = "remove",
            path = "/nonexistent"
        });
        var request = new PatchFeatureFlag { EnvId = Guid.NewGuid(), Key = "flag", Patch = patch };

        var result = await sut.Handle(request, CancellationToken.None);

        Assert.False(result.Success);
        Assert.False(string.IsNullOrWhiteSpace(result.Message));
        service.Verify(x => x.UpdateAsync(It.IsAny<FeatureFlag>()), Times.Never);
        publisher.Verify(
            x => x.Publish(It.IsAny<OnFeatureFlagChanged>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }

    [Fact]
    public async Task Handle_DisableInsightsWithRunningExperiment_ThrowsWithoutPersisting()
    {
        var flag = NewFlag();
        var service = new Mock<IFeatureFlagService>();
        service.Setup(x => x.GetAsync(It.IsAny<Guid>(), It.IsAny<string>())).ReturnsAsync(flag);
        var resourceService = new Mock<IResourceService>();
        resourceService.Setup(x => x.GetFlagRnAsync(It.IsAny<Guid>(), It.IsAny<string>())).ReturnsAsync("flag/*");
        var insightsGuard = new Mock<IFlagInsightsGuard>();
        insightsGuard
            .Setup(x => x.EnsureCanDisableInsightsAsync(true, flag))
            .ThrowsAsync(new InsightsRequiredByExperimentException([new ExperimentRef(Guid.NewGuid(), "expt")]));
        var publisher = new Mock<IPublisher>();
        var sut = new PatchFeatureFlagHandler(service.Object, new PermissionGuard(resourceService.Object), Mock.Of<ICurrentUser>(), insightsGuard.Object, publisher.Object);

        var patch = new JsonPatchDocument<FeatureFlag>();
        patch.Replace(x => x.InsightsEnabled, false);
        var request = new PatchFeatureFlag { EnvId = Guid.NewGuid(), Key = "flag", Patch = patch, Permissions = AllowAll() };

        await Assert.ThrowsAsync<InsightsRequiredByExperimentException>(() => sut.Handle(request, CancellationToken.None));

        service.Verify(x => x.UpdateAsync(It.IsAny<FeatureFlag>()), Times.Never);
        publisher.Verify(
            x => x.Publish(It.IsAny<OnFeatureFlagChanged>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }

    [Fact]
    public async Task Handle_DisableInsightsWithoutTogglePermission_ThrowsForbidden()
    {
        var flag = NewFlag();
        var service = new Mock<IFeatureFlagService>();
        service.Setup(x => x.GetAsync(It.IsAny<Guid>(), It.IsAny<string>())).ReturnsAsync(flag);
        var resourceService = new Mock<IResourceService>();
        resourceService.Setup(x => x.GetFlagRnAsync(It.IsAny<Guid>(), It.IsAny<string>())).ReturnsAsync("flag/*");
        var sut = new PatchFeatureFlagHandler(service.Object, new PermissionGuard(resourceService.Object), Mock.Of<ICurrentUser>(), Mock.Of<IFlagInsightsGuard>(), Mock.Of<IPublisher>());
        PolicyStatement[] descriptionOnly =
        [
            new PolicyStatement
            {
                Effect = EffectType.Allow,
                Actions = [Permissions.UpdateFlagDescription],
                Resources = ["*"]
            }
        ];

        var patch = new JsonPatchDocument<FeatureFlag>();
        patch.Replace(x => x.InsightsEnabled, false);
        var request = new PatchFeatureFlag { EnvId = Guid.NewGuid(), Key = "flag", Patch = patch, Permissions = descriptionOnly };

        await Assert.ThrowsAsync<ForbiddenException>(() => sut.Handle(request, CancellationToken.None));

        service.Verify(x => x.UpdateAsync(It.IsAny<FeatureFlag>()), Times.Never);
    }
}
