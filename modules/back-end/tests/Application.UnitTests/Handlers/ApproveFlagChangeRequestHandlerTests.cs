using System.Linq.Expressions;
using Application.FeatureFlags;
using Application.Services;
using Application.Users;
using Domain.FlagChangeRequests;
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
            scheduleId: scheduleId);
    }

    [Fact]
    public async Task Handle_NotFound_ReturnsFalse()
    {
        var crSvc = new Mock<IFlagChangeRequestService>();
        crSvc.Setup(x => x.FindOneAsync(It.IsAny<Expression<Func<FlagChangeRequest, bool>>>()))
            .ReturnsAsync((FlagChangeRequest?)null);
        var schedSvc = new Mock<IFlagScheduleService>();
        var sut = new ApproveFlagChangeRequestHandler(crSvc.Object, schedSvc.Object, Mock.Of<ICurrentUser>());

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
        var sut = new ApproveFlagChangeRequestHandler(crSvc.Object, schedSvc.Object, currentUser.Object);

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
        var sut = new ApproveFlagChangeRequestHandler(crSvc.Object, schedSvc.Object, currentUser.Object);

        var result = await sut.Handle(
            new ApproveFlagChangeRequest { OrgId = cr.OrgId, EnvId = cr.EnvId, Id = cr.Id },
            CancellationToken.None);

        Assert.True(result);
        Assert.Equal(FlagChangeRequestStatus.Approved, cr.Status);
        Assert.Equal(FlagChangeRequestAction.Approve, cr.Reviewers.Single().Action);
        crSvc.Verify(x => x.UpdateAsync(cr), Times.Once);
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
        var sut = new ApproveFlagChangeRequestHandler(crSvc.Object, schedSvc.Object, currentUser.Object);

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
