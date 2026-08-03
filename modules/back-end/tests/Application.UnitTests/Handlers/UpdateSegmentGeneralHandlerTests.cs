using Application.Bases.Exceptions;
using Application.Policies;
using Application.Segments;
using Application.Services;
using Application.Users;
using Domain.Policies;
using Domain.Resources;
using Domain.Segments;
using Domain.SemanticPatch;
using Domain.Targeting;
using MediatR;

namespace Application.UnitTests.Handlers;

public class UpdateSegmentGeneralHandlerTests
{
    private static Segment NewSegment()
    {
        var segment = new Segment(
            workspaceId: Guid.NewGuid(),
            envId: Guid.NewGuid(),
            name: "Segment",
            key: "segment",
            type: SegmentType.EnvironmentSpecific,
            scopes: [],
            included: [],
            excluded: [],
            rules: new List<MatchRule>(),
            description: "Description")
        {
            Id = Guid.NewGuid(),
            Tags = ["existing"]
        };

        return segment;
    }

    private static PolicyStatement[] Allow(params string[] actions) =>
    [
        new PolicyStatement
        {
            ResourceType = ResourceTypes.Segment,
            Effect = EffectType.Allow,
            Actions = actions,
            Resources = ["*"]
        }
    ];

    private static UpdateGeneral NewRequest(
        Segment segment,
        PolicyStatement[] permissions,
        string? name = null,
        string? description = null,
        string[]? tags = null) =>
        new(
            segment.Id,
            new UpdateGeneralPayload
            {
                Name = name ?? segment.Name,
                Description = description ?? segment.Description,
                Tags = tags ?? segment.Tags,
                Comment = "General settings update"
            },
            permissions);

    private static UpdateGeneralHandler BuildSut(
        Segment segment,
        Mock<ISegmentService> segmentService,
        Mock<IResourceService> resourceService,
        Mock<IPublisher> publisher)
    {
        segmentService.Setup(x => x.GetAsync(segment.Id)).ReturnsAsync(segment);
        resourceService
            .Setup(x => x.GetSegmentRnAsync(segment.EnvId, segment.Id))
            .ReturnsAsync("segment/*");

        var currentUser = new Mock<ICurrentUser>();
        currentUser.SetupGet(x => x.Id).Returns(Guid.NewGuid());

        return new UpdateGeneralHandler(
            segmentService.Object,
            new PermissionGuard(resourceService.Object),
            currentUser.Object,
            publisher.Object);
    }

    [Fact]
    public async Task Handle_AllFieldsChangedWithPermissions_UpdatesOnceAndPublishesOneCombinedChange()
    {
        var segment = NewSegment();
        var segmentService = new Mock<ISegmentService>();
        var resourceService = new Mock<IResourceService>();
        var publisher = new Mock<IPublisher>();
        var sut = BuildSut(segment, segmentService, resourceService, publisher);
        var request = NewRequest(
            segment,
            Allow(
                Permissions.UpdateSegmentName,
                Permissions.UpdateSegmentDescription,
                Permissions.UpdateSegmentTags),
            name: "Updated segment",
            description: "Updated description",
            tags: ["new"]);

        var success = await sut.Handle(request, CancellationToken.None);

        Assert.True(success);
        Assert.Equal("Updated segment", segment.Name);
        Assert.Equal("Updated description", segment.Description);
        Assert.Equal(["new"], segment.Tags);
        segmentService.Verify(x => x.UpdateAsync(segment), Times.Once);
        publisher.Verify(
            x => x.Publish(It.IsAny<OnSegmentChange>(), It.IsAny<CancellationToken>()),
            Times.Once);

        var notification = Assert.IsType<OnSegmentChange>(publisher.Invocations.Single().Arguments[0]);
        Assert.False(notification.IsTargetingChange);
        var instructions = SegmentComparer.Compare(notification.DataChange).ToArray();
        Assert.Contains(instructions, x => x.Kind == SegmentInstructionKind.UpdateName);
        Assert.Contains(instructions, x => x.Kind == SegmentInstructionKind.UpdateDescription);
        Assert.Contains(instructions, x => x.Kind == SegmentInstructionKind.RemoveTags);
        Assert.Contains(instructions, x => x.Kind == SegmentInstructionKind.AddTags);
    }

    [Theory]
    [InlineData("name", Permissions.UpdateSegmentDescription)]
    [InlineData("description", Permissions.UpdateSegmentTags)]
    [InlineData("tags", Permissions.UpdateSegmentName)]
    public async Task Handle_ChangedFieldWithoutItsPermission_ThrowsForbidden(
        string field,
        string grantedPermission)
    {
        var segment = NewSegment();
        var segmentService = new Mock<ISegmentService>();
        var resourceService = new Mock<IResourceService>();
        var publisher = new Mock<IPublisher>();
        var sut = BuildSut(segment, segmentService, resourceService, publisher);
        var request = NewRequest(
            segment,
            Allow(grantedPermission),
            name: field == "name" ? "Updated segment" : null,
            description: field == "description" ? "Updated description" : null,
            tags: field == "tags" ? ["new"] : null);

        await Assert.ThrowsAsync<ForbiddenException>(
            () => sut.Handle(request, CancellationToken.None));

        segmentService.Verify(x => x.UpdateAsync(It.IsAny<Segment>()), Times.Never);
        publisher.Verify(
            x => x.Publish(It.IsAny<OnSegmentChange>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }

    [Fact]
    public async Task Handle_OnlyNameChangedWithNamePermission_Succeeds()
    {
        var segment = NewSegment();
        var segmentService = new Mock<ISegmentService>();
        var resourceService = new Mock<IResourceService>();
        var publisher = new Mock<IPublisher>();
        var sut = BuildSut(segment, segmentService, resourceService, publisher);
        var request = NewRequest(
            segment,
            Allow(Permissions.UpdateSegmentName),
            name: "Updated segment");

        var success = await sut.Handle(request, CancellationToken.None);

        Assert.True(success);
        Assert.Equal("Updated segment", segment.Name);
        segmentService.Verify(x => x.UpdateAsync(segment), Times.Once);
    }

    [Fact]
    public async Task Handle_NoChanges_DoesNotRequirePermissionsOrWrite()
    {
        var segment = NewSegment();
        var segmentService = new Mock<ISegmentService>();
        var resourceService = new Mock<IResourceService>();
        var publisher = new Mock<IPublisher>();
        var sut = BuildSut(segment, segmentService, resourceService, publisher);
        var request = NewRequest(segment, []);

        var success = await sut.Handle(request, CancellationToken.None);

        Assert.True(success);
        resourceService.Verify(
            x => x.GetSegmentRnAsync(It.IsAny<Guid>(), It.IsAny<Guid>()),
            Times.Never);
        segmentService.Verify(x => x.UpdateAsync(It.IsAny<Segment>()), Times.Never);
        publisher.Verify(
            x => x.Publish(It.IsAny<OnSegmentChange>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }
}
