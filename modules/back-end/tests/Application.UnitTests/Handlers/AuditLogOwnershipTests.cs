using Application.Caches;
using Application.FeatureFlags;
using Application.Segments;
using Application.Services;
using Domain.AuditLogs;
using Domain.FeatureFlags;
using Domain.Organizations;
using Domain.Segments;
using Microsoft.Extensions.Configuration;

namespace Application.UnitTests.Handlers;

public class AuditLogOwnershipTests
{
    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task FlagNotifications_UseResourceEnvironmentOwnership(bool deleted)
    {
        var owner = new Organization(Guid.NewGuid(), "Owner", "owner") { Id = Guid.NewGuid() };
        var flag = new FeatureFlag { Id = Guid.NewGuid(), EnvId = Guid.NewGuid(), Name = "Flag", Key = "flag" };
        var logs = new Mock<IAuditLogService>();
        var actor = Guid.NewGuid();
        if (deleted)
            await new OnFeatureFlagDeletedHandler(Mock.Of<ICacheService>(), logs.Object,
                Mock.Of<IWebhookHandler>()).Handle(new OnFeatureFlagDeleted(flag, owner.WorkspaceId, owner.Id, actor), default);
        else
            await new OnFeatureFlagChangedHandler(Mock.Of<IFlagRevisionService>(), Mock.Of<ICacheService>(),
                logs.Object, Mock.Of<IWebhookHandler>(), Mock.Of<IFeatureFlagChangePublisher>(),
                new ConfigurationBuilder().Build()).Handle(
                    new OnFeatureFlagChanged(flag, owner.WorkspaceId, owner.Id, Operations.Update, new DataChange(flag).To(flag), actor), default);

        logs.Verify(x => x.AddOneAsync(It.Is<AuditLog>(log => log.WorkspaceId == owner.WorkspaceId &&
            log.OrganizationId == owner.Id && log.EnvId == flag.EnvId && log.CreatorId == actor)), Times.Once);
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task SharedSegmentNotifications_KeepOriginalEnvironmentWithoutOrganization(bool deleted)
    {
        var owner = new Organization(Guid.NewGuid(), "Owner", "owner") { Id = Guid.NewGuid() };
        var segment = new Segment(owner.WorkspaceId, Guid.NewGuid(), "Shared", "shared", SegmentType.Shared,
            [], [], [], [], "");
        var segments = new Mock<ISegmentService>();
        segments.Setup(x => x.GetEnvironmentIdsAsync(segment)).ReturnsAsync([Guid.NewGuid()]);
        var logs = new Mock<IAuditLogService>();
        var actor = Guid.NewGuid();
        if (deleted)
            await new OnSegmentDeletedHandler(Mock.Of<ICacheService>(), logs.Object,
                Mock.Of<IWebhookHandler>(), segments.Object).Handle(new OnSegmentDeleted(segment, owner.WorkspaceId, owner.Id, actor), default);
        else
            await new OnSegmentChangeHandler(segments.Object, Mock.Of<ICacheService>(), logs.Object,
                Mock.Of<IWebhookHandler>(), Mock.Of<ISegmentChangePublisher>(),
                new ConfigurationBuilder().Build()).Handle(
                    new OnSegmentChange(segment, owner.WorkspaceId, owner.Id, Operations.Update, new DataChange(segment).To(segment), actor), default);

        logs.Verify(x => x.AddOneAsync(It.Is<AuditLog>(log => log.WorkspaceId == owner.WorkspaceId &&
            log.OrganizationId == null && log.EnvId == segment.EnvId && log.CreatorId == actor)), Times.Once);
    }
    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public async Task SegmentFlagUpdates_UseNullOrganizationOnlyForSharedSegments(bool shared)
    {
        var workspaceId = Guid.NewGuid();
        var orgId = Guid.NewGuid();
        Guid? expectedOrgId = shared ? null : orgId;
        var first = new FeatureFlag { Id = Guid.NewGuid(), EnvId = Guid.NewGuid(), Name = "First", Key = "first" };
        var second = new FeatureFlag { Id = Guid.NewGuid(), EnvId = Guid.NewGuid(), Name = "Second", Key = "second" };
        var segment = new Segment(workspaceId, Guid.NewGuid(), "Segment", "segment", shared ? SegmentType.Shared : SegmentType.EnvironmentSpecific, [], [], [], [], "");
        var flags = new Mock<IFeatureFlagService>();
        flags.Setup(x => x.FindManyAsync(It.IsAny<System.Linq.Expressions.Expression<Func<FeatureFlag, bool>>>()))
            .ReturnsAsync([first, second]);
        AuditLog[] captured = [];
        var logs = new Mock<IAuditLogService>();
        logs.Setup(x => x.AddManyAsync(It.IsAny<IEnumerable<AuditLog>>()))
            .Callback<IEnumerable<AuditLog>>(items => captured = items.ToArray()).Returns(Task.CompletedTask);
        var service = new Infrastructure.AppService.FeatureFlagAppService(flags.Object, Mock.Of<IFlagDraftService>(),
            logs.Object, Mock.Of<ICacheService>(), Mock.Of<MediatR.IPublisher>());

        var segments = new Mock<ISegmentService>();
        segments.Setup(x => x.GetEnvironmentIdsAsync(segment)).ReturnsAsync([first.EnvId]);
        var messages = new Mock<ISegmentMessageService>();
        messages.Setup(x => x.GetAffectedFlagsAsync(first.EnvId, It.IsAny<OnSegmentChange>()))
            .ReturnsAsync([new FlagReference { Id = first.Id }, new FlagReference { Id = second.Id }]);
        var publisher = new DirectSegmentChangePublisher(messages.Object, service, segments.Object);
        await publisher.PublishAsync(new OnSegmentChange(segment, workspaceId, orgId, Operations.Update,
            new DataChange(segment).To(segment), Guid.NewGuid()));

        Assert.Equal(2, captured.Length);
        Assert.Contains(captured, x => x.RefId == first.Id.ToString() && x.EnvId == first.EnvId &&
            x.OrganizationId == expectedOrgId && x.WorkspaceId == workspaceId);
        Assert.Contains(captured, x => x.RefId == second.Id.ToString() && x.EnvId == second.EnvId &&
            x.OrganizationId == expectedOrgId && x.WorkspaceId == workspaceId);
    }
}
