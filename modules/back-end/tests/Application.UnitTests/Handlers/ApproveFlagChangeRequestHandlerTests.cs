using System.Linq.Expressions;
using Application.FeatureFlags;
using Application.Services;
using Application.Users;
using Domain.AuditLogs;
using Domain.FeatureFlags;
using Domain.FlagChangeRequests;
using Domain.FlagDrafts;
using Domain.FlagSchedules;

namespace Application.UnitTests.Handlers;

public class ApproveFlagChangeRequestHandlerTests
{
    private static FlagChangeRequest NewRequest(
        Guid orgId,
        Guid envId,
        Guid reviewerId,
        Guid? scheduleId = null)
    {
        return new FlagChangeRequest(
            orgId: orgId,
            envId: envId,
            flagDraftId: Guid.NewGuid(),
            flagId: Guid.NewGuid(),
            reviewers: new[] { reviewerId },
            currentUserId: Guid.NewGuid(),
            scheduleId: scheduleId,
            reason: "Ready for review");
    }

    private static Mock<IFlagDraftService> DraftServiceFor(FlagChangeRequest changeRequest)
    {
        var draft = new FlagDraft(
            changeRequest.EnvId,
            changeRequest.FlagId,
            new DataChange(new { version = "before" }).To(new { version = "after" }),
            Guid.NewGuid())
        {
            Id = changeRequest.FlagDraftId
        };
        var service = new Mock<IFlagDraftService>();
        service.Setup(x => x.FindOneAsync(It.IsAny<Expression<Func<FlagDraft, bool>>>() ))
            .ReturnsAsync(draft);
        return service;
    }

    [Fact]
    public async Task Handle_NotFound_ReturnsFalse()
    {
        var crSvc = new Mock<IFlagChangeRequestService>();
        crSvc.Setup(x => x.FindOneAsync(It.IsAny<Expression<Func<FlagChangeRequest, bool>>>()))
            .ReturnsAsync((FlagChangeRequest?)null);
        var schedSvc = new Mock<IFlagScheduleService>();
        var sut = new ApproveFlagChangeRequestHandler(
            crSvc.Object,
            schedSvc.Object,
            Mock.Of<IFeatureFlagService>(),
            Mock.Of<IFlagDraftService>(),
            Mock.Of<IAuditLogService>(),
            Mock.Of<ICurrentUser>());

        var result = await sut.Handle(
            new ApproveFlagChangeRequest { OrgId = Guid.NewGuid(), EnvId = Guid.NewGuid(), Id = Guid.NewGuid() },
            CancellationToken.None);

        Assert.False(result);
        crSvc.Verify(x => x.UpdateAsync(It.IsAny<FlagChangeRequest>()), Times.Never);
    }

    [Fact]
    public async Task Handle_NonReviewer_ReturnsFalse()
    {
        var cr = NewRequest(Guid.NewGuid(), Guid.NewGuid(), reviewerId: Guid.NewGuid());
        var crSvc = new Mock<IFlagChangeRequestService>();
        crSvc.Setup(x => x.FindOneAsync(It.IsAny<Expression<Func<FlagChangeRequest, bool>>>())).ReturnsAsync(cr);
        var currentUser = new Mock<ICurrentUser>();
        currentUser.SetupGet(x => x.Id).Returns(Guid.NewGuid()); // not a reviewer
        var schedSvc = new Mock<IFlagScheduleService>();
        var sut = new ApproveFlagChangeRequestHandler(
            crSvc.Object,
            schedSvc.Object,
            Mock.Of<IFeatureFlagService>(),
            Mock.Of<IFlagDraftService>(),
            Mock.Of<IAuditLogService>(),
            currentUser.Object);

        var result = await sut.Handle(
            new ApproveFlagChangeRequest { OrgId = cr.OrgId, EnvId = cr.EnvId, Id = cr.Id },
            CancellationToken.None);

        Assert.False(result);
        crSvc.Verify(x => x.UpdateAsync(It.IsAny<FlagChangeRequest>()), Times.Never);
        schedSvc.Verify(x => x.GetAsync(It.IsAny<Guid>()), Times.Never);
    }

    [Fact]
    public async Task Handle_ReviewerWithoutSchedule_ApprovesAndDoesNotTouchSchedule()
    {
        var reviewerId = Guid.NewGuid();
        var cr = NewRequest(Guid.NewGuid(), Guid.NewGuid(), reviewerId);
        var crSvc = new Mock<IFlagChangeRequestService>();
        crSvc.Setup(x => x.FindOneAsync(It.IsAny<Expression<Func<FlagChangeRequest, bool>>>())).ReturnsAsync(cr);
        var currentUser = new Mock<ICurrentUser>();
        currentUser.SetupGet(x => x.Id).Returns(reviewerId);
        var schedSvc = new Mock<IFlagScheduleService>(MockBehavior.Strict);
        var flag = new FeatureFlag
        {
            Id = cr.FlagId,
            EnvId = cr.EnvId,
            Name = "Checkout",
            Key = "checkout-v2"
        };
        var flagSvc = new Mock<IFeatureFlagService>();
        flagSvc.Setup(x => x.FindOneAsync(It.IsAny<Expression<Func<FeatureFlag, bool>>>()))
            .ReturnsAsync(flag);
        var draftSvc = DraftServiceFor(cr);
        var auditSvc = new Mock<IAuditLogService>();
        var sut = new ApproveFlagChangeRequestHandler(
            crSvc.Object,
            schedSvc.Object,
            flagSvc.Object,
            draftSvc.Object,
            auditSvc.Object,
            currentUser.Object);

        var result = await sut.Handle(
            new ApproveFlagChangeRequest
            {
                OrgId = cr.OrgId,
                EnvId = cr.EnvId,
                Id = cr.Id,
                Comment = "  Looks good  "
            },
            CancellationToken.None);

        Assert.True(result);
        Assert.Equal(FlagChangeRequestStatus.Approved, cr.Status);
        Assert.Equal(FlagChangeRequestAction.Approve, cr.Reviewers.Single().Action);
        crSvc.Verify(x => x.UpdateAsync(cr), Times.Once);
        auditSvc.Verify(x => x.AddOneAsync(It.Is<AuditLog>(log =>
            log.Operation == Operations.ApproveFlagChangeRequest &&
            log.Comment == "Looks good" &&
            log.CreatorId == reviewerId &&
            log.DataChange.Current.Contains(cr.Id.ToString()) &&
            log.DataChange.Current.Contains("Ready for review") &&
            log.DataChange.Current.Contains("proposedDataChange"))), Times.Once);
    }

    [Fact]
    public async Task Handle_ReviewerWithSchedule_TransitionsScheduleToPendingExecution()
    {
        var reviewerId = Guid.NewGuid();
        var scheduleId = Guid.NewGuid();
        var cr = NewRequest(Guid.NewGuid(), Guid.NewGuid(), reviewerId, scheduleId);
        var schedule = new FlagSchedule(
            orgId: cr.OrgId,
            envId: cr.EnvId,
            flagDraftId: cr.FlagDraftId,
            flagId: cr.FlagId,
            status: FlagScheduleStatus.PendingReview,
            title: "t",
            scheduledTime: DateTime.UtcNow.AddDays(1),
            currentUserId: Guid.NewGuid(),
            changeRequestId: cr.Id);

        var crSvc = new Mock<IFlagChangeRequestService>();
        crSvc.Setup(x => x.FindOneAsync(It.IsAny<Expression<Func<FlagChangeRequest, bool>>>())).ReturnsAsync(cr);
        var currentUser = new Mock<ICurrentUser>();
        currentUser.SetupGet(x => x.Id).Returns(reviewerId);
        var schedSvc = new Mock<IFlagScheduleService>();
        schedSvc.Setup(x => x.GetAsync(scheduleId)).ReturnsAsync(schedule);
        var flagSvc = new Mock<IFeatureFlagService>();
        flagSvc.Setup(x => x.FindOneAsync(It.IsAny<Expression<Func<FeatureFlag, bool>>>()))
            .ReturnsAsync(new FeatureFlag
            {
                Id = cr.FlagId,
                EnvId = cr.EnvId,
                Name = "Checkout",
                Key = "checkout-v2"
            });
        var draftSvc = DraftServiceFor(cr);
        var sut = new ApproveFlagChangeRequestHandler(
            crSvc.Object,
            schedSvc.Object,
            flagSvc.Object,
            draftSvc.Object,
            Mock.Of<IAuditLogService>(),
            currentUser.Object);

        var result = await sut.Handle(
            new ApproveFlagChangeRequest { OrgId = cr.OrgId, EnvId = cr.EnvId, Id = cr.Id },
            CancellationToken.None);

        Assert.True(result);
        Assert.Equal(FlagChangeRequestStatus.Approved, cr.Status);
        Assert.Equal(FlagScheduleStatus.PendingExecution, schedule.Status);
        crSvc.Verify(x => x.UpdateAsync(cr), Times.Once);
        schedSvc.Verify(x => x.UpdateAsync(schedule), Times.Once);
    }
}
