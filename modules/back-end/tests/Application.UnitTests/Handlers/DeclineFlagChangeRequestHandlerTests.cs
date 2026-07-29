using System.Linq.Expressions;
using Application.FeatureFlags;
using Application.Services;
using Application.Users;
using Domain.AuditLogs;
using Domain.FeatureFlags;
using Domain.FlagChangeRequests;
using Domain.FlagDrafts;

namespace Application.UnitTests.Handlers;

public class DeclineFlagChangeRequestHandlerTests
{
    private static FlagChangeRequest NewRequest(Guid reviewerId)
    {
        return new FlagChangeRequest(
            Guid.NewGuid(),
            Guid.NewGuid(),
            Guid.NewGuid(),
            Guid.NewGuid(),
            [reviewerId],
            Guid.NewGuid(),
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
    public async Task Handle_WithoutCommentFromNewClient_ReturnsFalse()
    {
        var reviewerId = Guid.NewGuid();
        var currentUser = new Mock<ICurrentUser>();
        currentUser.SetupGet(x => x.Id).Returns(reviewerId);
        var changeRequestService = new Mock<IFlagChangeRequestService>();
        var auditLogService = new Mock<IAuditLogService>();
        var sut = new DeclineFlagChangeRequestHandler(
            changeRequestService.Object,
            Mock.Of<IFlagScheduleService>(),
            Mock.Of<IFeatureFlagService>(),
            Mock.Of<IFlagDraftService>(),
            auditLogService.Object,
            currentUser.Object);

        var result = await sut.Handle(
            new DeclineFlagChangeRequest
            {
                OrgId = Guid.NewGuid(),
                EnvId = Guid.NewGuid(),
                Id = Guid.NewGuid(),
                Comment = " "
            },
            CancellationToken.None);

        Assert.False(result);
        changeRequestService.Verify(
            x => x.UpdateAsync(It.IsAny<FlagChangeRequest>()),
            Times.Never);
        auditLogService.Verify(
            x => x.AddOneAsync(It.IsAny<AuditLog>()),
            Times.Never);
    }

    [Fact]
    public async Task Handle_WithComment_DeclinesAndWritesImmutableAuditEvent()
    {
        var reviewerId = Guid.NewGuid();
        var changeRequest = NewRequest(reviewerId);
        var flag = new FeatureFlag
        {
            Id = changeRequest.FlagId,
            EnvId = changeRequest.EnvId,
            Name = "Checkout",
            Key = "checkout-v2"
        };
        var currentUser = new Mock<ICurrentUser>();
        currentUser.SetupGet(x => x.Id).Returns(reviewerId);
        var changeRequestService = new Mock<IFlagChangeRequestService>();
        changeRequestService
            .Setup(x => x.FindOneAsync(
                It.IsAny<Expression<Func<FlagChangeRequest, bool>>>()))
            .ReturnsAsync(changeRequest);
        var flagService = new Mock<IFeatureFlagService>();
        flagService
            .Setup(x => x.FindOneAsync(
                It.IsAny<Expression<Func<FeatureFlag, bool>>>()))
            .ReturnsAsync(flag);
        var draftService = DraftServiceFor(changeRequest);
        var auditLogService = new Mock<IAuditLogService>();
        var sut = new DeclineFlagChangeRequestHandler(
            changeRequestService.Object,
            Mock.Of<IFlagScheduleService>(),
            flagService.Object,
            draftService.Object,
            auditLogService.Object,
            currentUser.Object);

        var result = await sut.Handle(
            new DeclineFlagChangeRequest
            {
                OrgId = changeRequest.OrgId,
                EnvId = changeRequest.EnvId,
                Id = changeRequest.Id,
                Comment = "  Needs a rollback plan.  "
            },
            CancellationToken.None);

        Assert.True(result);
        Assert.Equal(FlagChangeRequestStatus.Declined, changeRequest.Status);
        auditLogService.Verify(x => x.AddOneAsync(It.Is<AuditLog>(log =>
            log.Operation == Operations.DeclineFlagChangeRequest &&
            log.Comment == "Needs a rollback plan." &&
            log.CreatorId == reviewerId &&
            log.DataChange.Current.Contains(changeRequest.Id.ToString()) &&
            log.DataChange.Current.Contains("Ready for review") &&
            log.DataChange.Current.Contains("proposedDataChange"))), Times.Once);
    }

}
