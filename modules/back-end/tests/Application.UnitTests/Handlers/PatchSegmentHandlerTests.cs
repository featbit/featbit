using Application.Segments;
using Application.Services;
using Application.Users;
using Domain.AuditLogs;
using Domain.Policies;
using Domain.Resources;
using Domain.Segments;
using Domain.Targeting;
using MediatR;
using Microsoft.AspNetCore.JsonPatch.SystemTextJson;
using Microsoft.AspNetCore.JsonPatch.SystemTextJson.Operations;

namespace Application.UnitTests.Handlers;

public class PatchSegmentHandlerTests
{
    private static Segment NewSegment() => new(
        workspaceId: Guid.NewGuid(),
        envId: Guid.NewGuid(),
        name: "seg",
        key: "seg",
        type: SegmentType.EnvironmentSpecific,
        scopes: Array.Empty<string>(),
        included: new[] { "user-1" },
        excluded: Array.Empty<string>(),
        rules: new List<MatchRule>(),
        description: "desc");

    private static PolicyStatement[] AllowAll() =>
    [
        new PolicyStatement
        {
            Effect = EffectType.Allow,
            Actions = new[] { "*" },
            Resources = new[] { "*" }
        }
    ];

    private static Mock<IResourceService> ResourceServiceMock()
    {
        var mock = new Mock<IResourceService>();
        mock.Setup(x => x.GetSegmentRnAsync(It.IsAny<Guid>(), It.IsAny<Guid>())).ReturnsAsync("segment/*");
        return mock;
    }

    [Fact]
    public async Task Handle_NonTargetingPatch_AppliesAndPublishesAsNonTargetingChange()
    {
        var segment = NewSegment();
        var service = new Mock<ISegmentService>();
        service.Setup(x => x.GetAsync(It.IsAny<Guid>())).ReturnsAsync(segment);
        var currentUser = new Mock<ICurrentUser>();
        var operatorId = Guid.NewGuid();
        currentUser.SetupGet(x => x.Id).Returns(operatorId);
        var publisher = new Mock<IPublisher>();
        var sut = new PatchSegmentHandler(service.Object, ResourceServiceMock().Object, currentUser.Object, publisher.Object);

        var patch = new JsonPatchDocument<Segment>();
        patch.Replace(x => x.Description, "patched");
        var request = new PatchSegment { Id = segment.Id, Patch = patch, Permissions = AllowAll() };

        var result = await sut.Handle(request, CancellationToken.None);

        Assert.True(result.Success);
        Assert.Equal("patched", segment.Description);
        service.Verify(x => x.UpdateAsync(segment), Times.Once);
        publisher.Verify(x => x.Publish(
            It.Is<OnSegmentChange>(n =>
                n.Operation == Operations.Update &&
                n.OperatorId == operatorId &&
                n.IsTargetingChange == false),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Handle_TargetingPatch_FlagsIsTargetingChange()
    {
        var segment = NewSegment();
        var service = new Mock<ISegmentService>();
        service.Setup(x => x.GetAsync(It.IsAny<Guid>())).ReturnsAsync(segment);
        var publisher = new Mock<IPublisher>();
        var sut = new PatchSegmentHandler(service.Object, ResourceServiceMock().Object, Mock.Of<ICurrentUser>(), publisher.Object);

        var patch = new JsonPatchDocument<Segment>();
        patch.Replace(x => x.Included, new[] { "user-1", "user-2" });
        var request = new PatchSegment { Id = segment.Id, Patch = patch, Permissions = AllowAll() };

        var result = await sut.Handle(request, CancellationToken.None);

        Assert.True(result.Success);
        publisher.Verify(x => x.Publish(
            It.Is<OnSegmentChange>(n => n.IsTargetingChange == true),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Handle_InvalidPatch_ReturnsFailureWithoutPersisting()
    {
        var segment = NewSegment();
        var service = new Mock<ISegmentService>();
        service.Setup(x => x.GetAsync(It.IsAny<Guid>())).ReturnsAsync(segment);
        var publisher = new Mock<IPublisher>();
        var sut = new PatchSegmentHandler(service.Object, Mock.Of<IResourceService>(), Mock.Of<ICurrentUser>(), publisher.Object);

        var patch = new JsonPatchDocument<Segment>();
        patch.Operations.Add(new Operation<Segment>
        {
            op = "remove",
            path = "/nonexistent"
        });
        var request = new PatchSegment { Id = segment.Id, Patch = patch };

        var result = await sut.Handle(request, CancellationToken.None);

        Assert.False(result.Success);
        Assert.False(string.IsNullOrWhiteSpace(result.Message));
        service.Verify(x => x.UpdateAsync(It.IsAny<Segment>()), Times.Never);
        publisher.Verify(
            x => x.Publish(It.IsAny<OnSegmentChange>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }
}
