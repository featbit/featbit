using Application.Bases.Exceptions;
using Application.FeatureFlags;
using Application.Services;
using Application.Users;
using Domain.FeatureFlags;
using Domain.Policies;
using Domain.Resources;
using Domain.SemanticPatch;
using MediatR;

namespace Application.UnitTests.Handlers;

public class UpdateGeneralHandlerTests
{
    private static FeatureFlag NewFlag()
    {
        var on = new Variation { Id = "v-on", Name = "On", Value = "true" };
        var off = new Variation { Id = "v-off", Name = "Off", Value = "false" };
        return new FeatureFlag(
            envId: Guid.NewGuid(),
            name: "Flag",
            description: "Description",
            key: "flag",
            isEnabled: true,
            variationType: VariationTypes.Boolean,
            variations: new[] { on, off },
            disabledVariationId: off.Id,
            enabledVariationId: on.Id,
            tags: ["existing"],
            currentUserId: Guid.NewGuid());
    }

    private static PolicyStatement[] Allow(params string[] actions) =>
    [
        new PolicyStatement
        {
            ResourceType = ResourceTypes.FeatureFlag,
            Effect = EffectType.Allow,
            Actions = actions,
            Resources = ["*"]
        }
    ];

    private static UpdateGeneral NewRequest(
        FeatureFlag flag,
        PolicyStatement[] permissions,
        string? name = null,
        string? description = null,
        string[]? tags = null) =>
        new(
            flag.EnvId,
            flag.Key,
            new UpdateGeneralPayload
            {
                Name = name ?? flag.Name,
                Description = description ?? flag.Description,
                Tags = tags ?? flag.Tags,
                Comment = "General settings update"
            },
            permissions);

    private static UpdateGeneralHandler BuildSut(
        FeatureFlag flag,
        Mock<IFeatureFlagService> flagService,
        Mock<IResourceService> resourceService,
        Mock<IPublisher> publisher)
    {
        flagService.Setup(x => x.GetAsync(flag.EnvId, flag.Key)).ReturnsAsync(flag);
        resourceService.Setup(x => x.GetFlagRnAsync(flag.EnvId, flag.Key)).ReturnsAsync("flag/*");

        var currentUser = new Mock<ICurrentUser>();
        currentUser.SetupGet(x => x.Id).Returns(Guid.NewGuid());

        return new UpdateGeneralHandler(
            flagService.Object,
            resourceService.Object,
            currentUser.Object,
            publisher.Object);
    }

    [Fact]
    public async Task Handle_AllFieldsChangedWithPermissions_UpdatesOnceAndPublishesOneCombinedChange()
    {
        var flag = NewFlag();
        var previousRevision = flag.Revision;
        var flagService = new Mock<IFeatureFlagService>();
        var resourceService = new Mock<IResourceService>();
        var publisher = new Mock<IPublisher>();
        var sut = BuildSut(flag, flagService, resourceService, publisher);
        var request = NewRequest(
            flag,
            Allow(
                Permissions.UpdateFlagName,
                Permissions.UpdateFlagDescription,
                Permissions.UpdateFlagTags),
            name: "Updated flag",
            description: "Updated description",
            tags: ["new"]);

        var revision = await sut.Handle(request, CancellationToken.None);

        Assert.Equal("Updated flag", flag.Name);
        Assert.Equal("Updated description", flag.Description);
        Assert.Equal(["new"], flag.Tags);
        Assert.NotEqual(previousRevision, revision);
        Assert.Equal(flag.Revision, revision);
        flagService.Verify(x => x.UpdateAsync(flag), Times.Once);
        publisher.Verify(
            x => x.Publish(It.IsAny<OnFeatureFlagChanged>(), It.IsAny<CancellationToken>()),
            Times.Once);

        var notification = Assert.IsType<OnFeatureFlagChanged>(publisher.Invocations.Single().Arguments[0]);
        var instructions = FlagComparer.Compare(notification.DataChange).ToArray();
        Assert.Contains(instructions, x => x.Kind == FlagInstructionKind.UpdateName);
        Assert.Contains(instructions, x => x.Kind == FlagInstructionKind.UpdateDescription);
        Assert.Contains(instructions, x => x.Kind == FlagInstructionKind.RemoveTags);
        Assert.Contains(instructions, x => x.Kind == FlagInstructionKind.AddTags);
    }

    [Theory]
    [InlineData("name", Permissions.UpdateFlagDescription)]
    [InlineData("description", Permissions.UpdateFlagTags)]
    [InlineData("tags", Permissions.UpdateFlagName)]
    public async Task Handle_ChangedFieldWithoutItsPermission_ThrowsForbidden(
        string field,
        string grantedPermission)
    {
        var flag = NewFlag();
        var flagService = new Mock<IFeatureFlagService>();
        var resourceService = new Mock<IResourceService>();
        var publisher = new Mock<IPublisher>();
        var sut = BuildSut(flag, flagService, resourceService, publisher);
        var request = NewRequest(
            flag,
            Allow(grantedPermission),
            name: field == "name" ? "Updated flag" : null,
            description: field == "description" ? "Updated description" : null,
            tags: field == "tags" ? ["new"] : null);

        await Assert.ThrowsAsync<ForbiddenException>(
            () => sut.Handle(request, CancellationToken.None));

        flagService.Verify(x => x.UpdateAsync(It.IsAny<FeatureFlag>()), Times.Never);
        publisher.Verify(
            x => x.Publish(It.IsAny<OnFeatureFlagChanged>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }

    [Fact]
    public async Task Handle_OnlyNameChangedWithNamePermission_Succeeds()
    {
        var flag = NewFlag();
        var flagService = new Mock<IFeatureFlagService>();
        var resourceService = new Mock<IResourceService>();
        var publisher = new Mock<IPublisher>();
        var sut = BuildSut(flag, flagService, resourceService, publisher);
        var request = NewRequest(
            flag,
            Allow(Permissions.UpdateFlagName),
            name: "Updated flag");

        await sut.Handle(request, CancellationToken.None);

        Assert.Equal("Updated flag", flag.Name);
        flagService.Verify(x => x.UpdateAsync(flag), Times.Once);
    }

    [Fact]
    public async Task Handle_NoChanges_DoesNotRequirePermissionsOrWrite()
    {
        var flag = NewFlag();
        var flagService = new Mock<IFeatureFlagService>();
        var resourceService = new Mock<IResourceService>();
        var publisher = new Mock<IPublisher>();
        var sut = BuildSut(flag, flagService, resourceService, publisher);
        var request = NewRequest(flag, []);

        var revision = await sut.Handle(request, CancellationToken.None);

        Assert.Equal(flag.Revision, revision);
        resourceService.Verify(
            x => x.GetFlagRnAsync(It.IsAny<Guid>(), It.IsAny<string>()),
            Times.Never);
        flagService.Verify(x => x.UpdateAsync(It.IsAny<FeatureFlag>()), Times.Never);
        publisher.Verify(
            x => x.Publish(It.IsAny<OnFeatureFlagChanged>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }
}
