using Application.FeatureFlags;
using Application.Segments;
using Application.Services;
using Application.Users;
using Domain.FeatureFlags;
using Domain.Organizations;
using Domain.Segments;
using MediatR;
using System.Linq.Expressions;

namespace Application.UnitTests.Handlers;

public class AuditNotificationPublisherTests
{
    [Fact]
    public async Task CopyToEnvironment_PublishesRequestOwnership()
    {
        var sourceEnv = Guid.NewGuid();
        var targetEnv = Guid.NewGuid();
        var owner = new Organization(Guid.NewGuid(), "Target", "target") { Id = Guid.NewGuid() };
        var flag = new FeatureFlag { Id = Guid.NewGuid(), EnvId = sourceEnv, Name = "Flag", Key = "flag" };
        var flags = new Mock<IFeatureFlagService>();
        flags.Setup(x => x.FindManyAsync(It.IsAny<Expression<Func<FeatureFlag, bool>>>())).ReturnsAsync([flag]);
        var environments = new Mock<IEnvironmentService>(MockBehavior.Strict);
        environments.Setup(x => x.GetProjectEnvAsync(sourceEnv)).ReturnsAsync("source/env");
        var publisher = new Mock<IPublisher>();
        var handler = new CopyToEnvHandler(flags.Object, Mock.Of<IEndUserService>(), environments.Object,
            Mock.Of<ICurrentUser>(), publisher.Object);

        await handler.Handle(new CopyToEnv
        {
            WorkspaceId = owner.WorkspaceId, OrgId = owner.Id,
            SourceEnvId = sourceEnv, TargetEnvId = targetEnv, FlagIds = [flag.Id],
            PrecheckResults = [new CopyToEnvPrecheckResult { Id = flag.Id, KeyCheck = true, NewProperties = [] }]
        }, default);

        publisher.Verify(x => x.Publish(It.Is<OnFeatureFlagChanged>(n => n.Flag.EnvId == targetEnv &&
            n.WorkspaceId == owner.WorkspaceId && n.OrganizationId == owner.Id), It.IsAny<CancellationToken>()), Times.Once);
        environments.VerifyAll();
    }

    [Fact]
    public async Task DeleteFlag_PublishesRequestOwnership()
    {
        var owner = new Organization(Guid.NewGuid(), "Owner", "owner") { Id = Guid.NewGuid() };
        var flag = new FeatureFlag { Id = Guid.NewGuid(), EnvId = Guid.NewGuid(), IsArchived = true, Name = "Flag", Key = "flag" };
        var flags = new Mock<IFeatureFlagService>();
        flags.Setup(x => x.GetAsync(It.IsAny<Guid>(), "flag")).ReturnsAsync(flag);
        var publisher = new Mock<IPublisher>();
        await new DeleteFeatureFlagHandler(flags.Object, publisher.Object, Mock.Of<ICurrentUser>())
            .Handle(new DeleteFeatureFlag { WorkspaceId = owner.WorkspaceId, OrgId = owner.Id, EnvId = flag.EnvId, Key = "flag" }, default);

        publisher.Verify(x => x.Publish(It.Is<OnFeatureFlagDeleted>(n => n.WorkspaceId == owner.WorkspaceId &&
            n.OrganizationId == owner.Id && n.Flag.EnvId == flag.EnvId), It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task DeleteSharedSegment_PublishesRequestOwnershipAndOriginalEnvironment()
    {
        var owner = new Organization(Guid.NewGuid(), "Owner", "owner") { Id = Guid.NewGuid() };
        var segment = new Segment(owner.WorkspaceId, Guid.NewGuid(), "Shared", "shared", SegmentType.Shared,
            [], [], [], [], "") { IsArchived = true };
        var segments = new Mock<ISegmentService>();
        segments.Setup(x => x.GetAsync(segment.Id)).ReturnsAsync(segment);
        var publisher = new Mock<IPublisher>();
        await new DeleteSegmentHandler(segments.Object, Mock.Of<ICurrentUser>(), publisher.Object)
            .Handle(new DeleteSegment { WorkspaceId = owner.WorkspaceId, OrgId = owner.Id, Id = segment.Id }, default);

        publisher.Verify(x => x.Publish(It.Is<OnSegmentDeleted>(n => n.WorkspaceId == owner.WorkspaceId &&
            n.OrganizationId == owner.Id && n.Segment.EnvId == segment.EnvId), It.IsAny<CancellationToken>()), Times.Once);
    }
}
