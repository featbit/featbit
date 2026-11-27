using Application.FeatureFlags;
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
    private static readonly Guid OrganizationId = Guid.NewGuid();
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
        var targetResolver = new Mock<IPermissionTargetResolver>();
        targetResolver.Setup(x => x.ResolveFlagAsync(It.IsAny<Guid>(), It.IsAny<string>())).ReturnsAsync(new PermissionTarget("flag/*", OrganizationId));
        var sut = new PatchFeatureFlagHandler(service.Object, new FlagPermissionGuard(targetResolver.Object), currentUser.Object, publisher.Object);

        var patch = new JsonPatchDocument<FeatureFlag>();
        patch.Replace(x => x.Description, "patched");
        var request = new PatchFeatureFlag { OrgId = OrganizationId, EnvId = Guid.NewGuid(), Key = "flag", Patch = patch, Permissions = AllowAll() };

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
    public async Task Handle_MissingArrayItem_ReturnsFailureWithoutPersisting()
    {
        var flag = NewFlag();
        var service = new Mock<IFeatureFlagService>();
        service.Setup(x => x.GetAsync(It.IsAny<Guid>(), It.IsAny<string>())).ReturnsAsync(flag);
        var publisher = new Mock<IPublisher>();
        var targetResolver = Mock.Of<IPermissionTargetResolver>();
        var sut = new PatchFeatureFlagHandler(service.Object, new FlagPermissionGuard(targetResolver), Mock.Of<ICurrentUser>(), publisher.Object);

        // An allowed path with a missing array item still fails when the patch is applied.
        var patch = new JsonPatchDocument<FeatureFlag>();
        patch.Operations.Add(new Operation<FeatureFlag>
        {
            op = "remove",
            path = "/rules/0"
        });
        var request = new PatchFeatureFlag { OrgId = OrganizationId, EnvId = Guid.NewGuid(), Key = "flag", Patch = patch };

        var result = await sut.Handle(request, CancellationToken.None);

        Assert.False(result.Success);
        Assert.False(string.IsNullOrWhiteSpace(result.Message));
        service.Verify(x => x.UpdateAsync(It.IsAny<FeatureFlag>()), Times.Never);
        publisher.Verify(
            x => x.Publish(It.IsAny<OnFeatureFlagChanged>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }
}
