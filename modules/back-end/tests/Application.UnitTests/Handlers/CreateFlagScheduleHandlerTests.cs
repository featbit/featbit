using Application.Bases;
using Application.Bases.Exceptions;
using Application.FeatureFlags;
using Application.Services;
using Application.Users;
using Domain.FeatureFlags;
using Domain.FlagChangeRequests;
using Domain.FlagDrafts;
using Domain.FlagSchedules;
using Domain.Targeting;
using Domain.Workspaces;

namespace Application.UnitTests.Handlers;

public class CreateFlagScheduleHandlerTests
{
    private static FeatureFlag NewFlag()
    {
        var on = new Variation { Id = "v-on", Name = "On", Value = "true" };
        var off = new Variation { Id = "v-off", Name = "Off", Value = "false" };
        return new FeatureFlag(
            envId: Guid.NewGuid(),
            name: "Flag",
            description: "desc",
            key: "flag",
            isEnabled: true,
            variationType: VariationTypes.Boolean,
            variations: new[] { on, off },
            disabledVariationId: off.Id,
            enabledVariationId: on.Id,
            tags: Array.Empty<string>(),
            currentUserId: Guid.NewGuid());
    }

    private static FlagTargeting NewTargeting(FeatureFlag flag) => new()
    {
        TargetUsers = flag.TargetUsers,
        Rules = new List<TargetRule>(),
        Fallthrough = flag.Fallthrough,
        ExptIncludeAllTargets = flag.ExptIncludeAllTargets
    };

    private static (CreateFlagScheduleHandler sut,
        Mock<IFeatureFlagService> flagSvc,
        Mock<ILicenseService> licenseSvc,
        Mock<IFlagScheduleService> schedSvc,
        Mock<IFlagChangeRequestService> crSvc,
        Mock<IFlagDraftService> draftSvc) BuildSut(FeatureFlag flag, Guid currentUserId)
    {
        var flagSvc = new Mock<IFeatureFlagService>();
        flagSvc.Setup(x => x.GetAsync(It.IsAny<Guid>(), It.IsAny<string>())).ReturnsAsync(flag);

        var licenseSvc = new Mock<ILicenseService>();
        var schedSvc = new Mock<IFlagScheduleService>();
        var crSvc = new Mock<IFlagChangeRequestService>();
        var draftSvc = new Mock<IFlagDraftService>();
        var currentUser = new Mock<ICurrentUser>();
        currentUser.SetupGet(x => x.Id).Returns(currentUserId);

        var sut = new CreateFlagScheduleHandler(
            flagSvc.Object,
            licenseSvc.Object,
            schedSvc.Object,
            crSvc.Object,
            draftSvc.Object,
            currentUser.Object);

        return (sut, flagSvc, licenseSvc, schedSvc, crSvc, draftSvc);
    }

    private static CreateFlagSchedule BuildRequest(FeatureFlag flag, bool withChangeRequest) => new()
    {
        WorkspaceId = Guid.NewGuid(),
        OrgId = Guid.NewGuid(),
        EnvId = flag.EnvId,
        Revision = flag.Revision,
        Key = flag.Key,
        Targeting = NewTargeting(flag),
        Title = "schedule",
        ScheduledTime = DateTime.UtcNow.AddHours(1),
        WithChangeRequest = withChangeRequest,
        Reason = "reason",
        Reviewers = new[] { Guid.NewGuid() }
    };

    [Fact]
    public async Task Handle_RevisionMismatch_ThrowsConflictAndDoesNotPersistAnything()
    {
        var flag = NewFlag();
        var (sut, _, licenseSvc, schedSvc, crSvc, draftSvc) = BuildSut(flag, Guid.NewGuid());
        var request = BuildRequest(flag, withChangeRequest: false);
        request.Revision = Guid.NewGuid(); // mismatch

        await Assert.ThrowsAsync<ConflictException>(() => sut.Handle(request, CancellationToken.None));

        draftSvc.Verify(x => x.AddOneAsync(It.IsAny<FlagDraft>()), Times.Never);
        schedSvc.Verify(x => x.AddOneAsync(It.IsAny<FlagSchedule>()), Times.Never);
        crSvc.Verify(x => x.AddOneAsync(It.IsAny<FlagChangeRequest>()), Times.Never);
        licenseSvc.Verify(x => x.IsFeatureGrantedAsync(It.IsAny<Guid>(), It.IsAny<string>()), Times.Never);
    }

    [Fact]
    public async Task Handle_WithoutChangeRequest_CreatesDraftAndSchedulePendingExecution()
    {
        var flag = NewFlag();
        var userId = Guid.NewGuid();
        var (sut, _, licenseSvc, schedSvc, crSvc, draftSvc) = BuildSut(flag, userId);
        var request = BuildRequest(flag, withChangeRequest: false);

        FlagSchedule? captured = null;
        schedSvc.Setup(x => x.AddOneAsync(It.IsAny<FlagSchedule>()))
            .Callback<FlagSchedule>(s => captured = s);

        var result = await sut.Handle(request, CancellationToken.None);

        Assert.True(result);
        draftSvc.Verify(x => x.AddOneAsync(It.IsAny<FlagDraft>()), Times.Once);
        schedSvc.Verify(x => x.AddOneAsync(It.IsAny<FlagSchedule>()), Times.Once);
        Assert.NotNull(captured);
        Assert.Equal(FlagScheduleStatus.PendingExecution, captured!.Status);
        Assert.Null(captured.ChangeRequestId);

        // license-gate should NOT be touched when WithChangeRequest=false
        licenseSvc.Verify(x => x.IsFeatureGrantedAsync(It.IsAny<Guid>(), It.IsAny<string>()), Times.Never);
        crSvc.Verify(x => x.AddOneAsync(It.IsAny<FlagChangeRequest>()), Times.Never);
    }

    [Fact]
    public async Task Handle_WithChangeRequestButLicenseDenied_ThrowsUnauthorizedAndDoesNotCreateScheduleOrCR()
    {
        var flag = NewFlag();
        var (sut, _, licenseSvc, schedSvc, crSvc, draftSvc) = BuildSut(flag, Guid.NewGuid());
        var request = BuildRequest(flag, withChangeRequest: true);

        licenseSvc.Setup(x => x.IsFeatureGrantedAsync(request.WorkspaceId, LicenseFeatures.ChangeRequest))
            .ReturnsAsync(false);

        var ex = await Assert.ThrowsAsync<BusinessException>(
            () => sut.Handle(request, CancellationToken.None));

        Assert.Equal(ErrorCodes.Unauthorized, ex.Message);

        // draft is created BEFORE the license check (matches current handler ordering)
        draftSvc.Verify(x => x.AddOneAsync(It.IsAny<FlagDraft>()), Times.Once);

        // license gate prevents change request creation AND short-circuits schedule creation
        licenseSvc.Verify(
            x => x.IsFeatureGrantedAsync(request.WorkspaceId, LicenseFeatures.ChangeRequest),
            Times.Once);
        crSvc.Verify(x => x.AddOneAsync(It.IsAny<FlagChangeRequest>()), Times.Never);
        schedSvc.Verify(x => x.AddOneAsync(It.IsAny<FlagSchedule>()), Times.Never);
    }

    [Fact]
    public async Task Handle_WithChangeRequestGranted_CreatesPendingReviewScheduleAndLinksToChangeRequest()
    {
        var flag = NewFlag();
        var userId = Guid.NewGuid();
        var (sut, _, licenseSvc, schedSvc, crSvc, draftSvc) = BuildSut(flag, userId);
        var request = BuildRequest(flag, withChangeRequest: true);

        licenseSvc.Setup(x => x.IsFeatureGrantedAsync(request.WorkspaceId, LicenseFeatures.ChangeRequest))
            .ReturnsAsync(true);

        FlagChangeRequest? capturedCr = null;
        crSvc.Setup(x => x.AddOneAsync(It.IsAny<FlagChangeRequest>()))
            .Callback<FlagChangeRequest>(cr => capturedCr = cr);

        FlagSchedule? capturedSchedule = null;
        schedSvc.Setup(x => x.AddOneAsync(It.IsAny<FlagSchedule>()))
            .Callback<FlagSchedule>(s => capturedSchedule = s);

        var result = await sut.Handle(request, CancellationToken.None);

        Assert.True(result);

        Assert.NotNull(capturedCr);
        Assert.NotNull(capturedSchedule);
        Assert.Equal(FlagScheduleStatus.PendingReview, capturedSchedule!.Status);
        Assert.Equal(capturedCr!.Id, capturedSchedule.ChangeRequestId);
        Assert.Equal(capturedSchedule.Id, capturedCr.ScheduleId);

        crSvc.Verify(x => x.UpdateAsync(capturedCr), Times.Once);
        draftSvc.Verify(x => x.AddOneAsync(It.IsAny<FlagDraft>()), Times.Once);
    }
}
