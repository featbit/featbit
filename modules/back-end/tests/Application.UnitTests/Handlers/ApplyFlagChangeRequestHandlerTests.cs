using System.Linq.Expressions;
using Application.FeatureFlags;
using Application.Services;
using Application.Users;
using Domain.AuditLogs;
using Domain.FlagChangeRequests;

namespace Application.UnitTests.Handlers;

public class ApplyFlagChangeRequestHandlerTests
{
    private static FlagChangeRequest NewRequest(
        Guid orgId,
        Guid envId,
        Guid reviewerId,
        Guid creatorId,
        string status)
    {
        var cr = new FlagChangeRequest(
            orgId: orgId,
            envId: envId,
            flagDraftId: Guid.NewGuid(),
            flagId: Guid.NewGuid(),
            reviewers: new[] { reviewerId },
            currentUserId: creatorId);
        cr.Status = status;
        return cr;
    }

    [Fact]
    public async Task Handle_NotFound_ReturnsFalse()
    {
        var crSvc = new Mock<IFlagChangeRequestService>();
        crSvc.Setup(x => x.FindOneAsync(It.IsAny<Expression<Func<FlagChangeRequest, bool>>>()))
            .ReturnsAsync((FlagChangeRequest?)null);
        var ffApp = new Mock<IFeatureFlagAppService>();
        var sut = new ApplyFlagChangeRequestHandler(crSvc.Object, ffApp.Object, Mock.Of<ICurrentUser>());

        var result = await sut.Handle(
            new ApplyFlagChangeRequest { OrgId = Guid.NewGuid(), EnvId = Guid.NewGuid(), Id = Guid.NewGuid() },
            CancellationToken.None);

        Assert.False(result);
        ffApp.Verify(x => x.ApplyDraftAsync(It.IsAny<Guid>(), It.IsAny<string>(), It.IsAny<Guid>()), Times.Never);
        crSvc.Verify(x => x.UpdateAsync(It.IsAny<FlagChangeRequest>()), Times.Never);
    }

    [Fact]
    public async Task Handle_NotApprovedYet_ReturnsFalseAndDoesNotApply()
    {
        var orgId = Guid.NewGuid();
        var envId = Guid.NewGuid();
        var reviewerId = Guid.NewGuid();
        var cr = NewRequest(orgId, envId, reviewerId, creatorId: reviewerId, FlagChangeRequestStatus.PendingReview);
        var crSvc = new Mock<IFlagChangeRequestService>();
        crSvc.Setup(x => x.FindOneAsync(It.IsAny<Expression<Func<FlagChangeRequest, bool>>>())).ReturnsAsync(cr);
        var currentUser = new Mock<ICurrentUser>();
        currentUser.SetupGet(x => x.Id).Returns(reviewerId);
        var ffApp = new Mock<IFeatureFlagAppService>();
        var sut = new ApplyFlagChangeRequestHandler(crSvc.Object, ffApp.Object, currentUser.Object);

        var result = await sut.Handle(
            new ApplyFlagChangeRequest { OrgId = orgId, EnvId = envId, Id = cr.Id },
            CancellationToken.None);

        Assert.False(result);
        ffApp.Verify(x => x.ApplyDraftAsync(It.IsAny<Guid>(), It.IsAny<string>(), It.IsAny<Guid>()), Times.Never);
        crSvc.Verify(x => x.UpdateAsync(It.IsAny<FlagChangeRequest>()), Times.Never);
    }

    [Fact]
    public async Task Handle_NonReviewerNonCreator_ReturnsFalse()
    {
        var orgId = Guid.NewGuid();
        var envId = Guid.NewGuid();
        var reviewerId = Guid.NewGuid();
        var creatorId = Guid.NewGuid();
        var cr = NewRequest(orgId, envId, reviewerId, creatorId, FlagChangeRequestStatus.Approved);
        var crSvc = new Mock<IFlagChangeRequestService>();
        crSvc.Setup(x => x.FindOneAsync(It.IsAny<Expression<Func<FlagChangeRequest, bool>>>())).ReturnsAsync(cr);
        var currentUser = new Mock<ICurrentUser>();
        currentUser.SetupGet(x => x.Id).Returns(Guid.NewGuid()); // unrelated user
        var ffApp = new Mock<IFeatureFlagAppService>();
        var sut = new ApplyFlagChangeRequestHandler(crSvc.Object, ffApp.Object, currentUser.Object);

        var result = await sut.Handle(
            new ApplyFlagChangeRequest { OrgId = orgId, EnvId = envId, Id = cr.Id },
            CancellationToken.None);

        Assert.False(result);
        ffApp.Verify(x => x.ApplyDraftAsync(It.IsAny<Guid>(), It.IsAny<string>(), It.IsAny<Guid>()), Times.Never);
    }

    [Fact]
    public async Task Handle_ApprovedAndByCreator_AppliesDraftAndMarksApplied()
    {
        var orgId = Guid.NewGuid();
        var envId = Guid.NewGuid();
        var reviewerId = Guid.NewGuid();
        var creatorId = Guid.NewGuid();
        var cr = NewRequest(orgId, envId, reviewerId, creatorId, FlagChangeRequestStatus.Approved);
        var crSvc = new Mock<IFlagChangeRequestService>();
        crSvc.Setup(x => x.FindOneAsync(It.IsAny<Expression<Func<FlagChangeRequest, bool>>>())).ReturnsAsync(cr);
        var currentUser = new Mock<ICurrentUser>();
        currentUser.SetupGet(x => x.Id).Returns(creatorId);
        var ffApp = new Mock<IFeatureFlagAppService>();
        var sut = new ApplyFlagChangeRequestHandler(crSvc.Object, ffApp.Object, currentUser.Object);

        var result = await sut.Handle(
            new ApplyFlagChangeRequest { OrgId = orgId, EnvId = envId, Id = cr.Id },
            CancellationToken.None);

        Assert.True(result);
        Assert.Equal(FlagChangeRequestStatus.Applied, cr.Status);
        ffApp.Verify(x => x.ApplyDraftAsync(
            cr.FlagDraftId, Operations.ApplyFlagChangeRequest, creatorId), Times.Once);
        crSvc.Verify(x => x.UpdateAsync(cr), Times.Once);
    }
}
