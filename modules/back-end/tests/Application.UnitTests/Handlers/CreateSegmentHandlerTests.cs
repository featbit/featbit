using Application.Segments;
using Application.Services;
using Application.Users;
using Domain.Resources;
using Domain.Segments;
using Domain.Workspaces;
using MediatR;

namespace Application.UnitTests.Handlers;

public class CreateSegmentHandlerTests
{
    [Fact]
    public async Task Handle_EnvironmentSpecific_UsesCanonicalEnvironmentScope()
    {
        var envId = Guid.NewGuid();
        const string canonicalRn = "organization/acme:project/payments:env/production";
        var segmentService = new Mock<ISegmentService>();
        Segment? captured = null;
        segmentService
            .Setup(x => x.AddOneAsync(It.IsAny<Segment>()))
            .Callback<Segment>(segment => captured = segment)
            .Returns(Task.CompletedTask);
        var resourceService = new Mock<IResourceServiceV2>();
        resourceService
            .Setup(x => x.GetRNAsync(envId, ResourceTypes.Env))
            .ReturnsAsync(canonicalRn);
        var currentUser = new Mock<ICurrentUser>();
        currentUser.SetupGet(x => x.Id).Returns(Guid.NewGuid());
        var sut = new CreateSegmentHandler(
            segmentService.Object,
            Mock.Of<ILicenseService>(),
            Mock.Of<IPublisher>(),
            currentUser.Object,
            resourceService.Object);

        var result = await sut.Handle(new CreateSegment
        {
            WorkspaceId = Guid.NewGuid(),
            EnvId = envId,
            Type = SegmentType.EnvironmentSpecific,
            Name = "Production users",
            Key = "production-users",
            Scopes = ["project/payments:env/production"]
        }, CancellationToken.None);

        Assert.Same(result, captured);
        Assert.Equal([canonicalRn], result.Scopes);
        resourceService.Verify(x => x.GetRNAsync(envId, ResourceTypes.Env), Times.Once);
    }
}
