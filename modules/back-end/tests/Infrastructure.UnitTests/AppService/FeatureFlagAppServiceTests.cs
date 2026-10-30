using Application.Caches;
using Application.FeatureFlags;
using Application.Services;
using Domain.AuditLogs;
using Domain.FeatureFlags;
using Domain.FlagDrafts;
using Domain.Targeting;
using FluentValidation;
using Infrastructure.AppService;
using MediatR;
using Moq;

namespace Infrastructure.UnitTests.AppService;

public class FeatureFlagAppServiceTests
{
    [Fact]
    public async Task ApplyDraftAsync_EmptyAssignmentAndVariationRemoved_ClearsTheOldRow()
    {
        var flag = NewFlag();
        flag.DisabledVariationId = "on";
        flag.TargetUsers = new List<TargetUser> { new() { VariationId = "off", KeyIds = [] } };
        var next = flag.Clone();
        next.Variations = next.Variations.Where(x => x.Id != "off").ToList();
        next.TargetUsers = [];
        var draft = new FlagDraft(flag.EnvId, flag.Id, new DataChange(flag).To(next), Guid.NewGuid());
        var flags = new Mock<IFeatureFlagService>();
        flags.Setup(x => x.GetAsync(flag.Id)).ReturnsAsync(flag);
        var drafts = new Mock<IFlagDraftService>();
        drafts.Setup(x => x.GetAsync(draft.Id)).ReturnsAsync(draft);
        var sut = new FeatureFlagAppService(flags.Object, drafts.Object, Mock.Of<IAuditLogService>(),
            Mock.Of<ICacheService>(), Mock.Of<IPublisher>());

        await sut.ApplyDraftAsync(draft.Id, Operations.ApplyFlagSchedule, Guid.NewGuid());

        Assert.True(draft.IsApplied());
        Assert.Empty(flag.TargetUsers);
        Assert.DoesNotContain(flag.Variations, x => x.Id == "off");
        flags.Verify(x => x.UpdateAsync(flag), Times.Once);
    }

    [Theory]
    [InlineData(false, false)]
    [InlineData(true, false)]
    [InlineData(false, true)]
    [InlineData(true, true)]
    public async Task ApplyDraftAsync_VariationRemoved_ValidatesFinalStateBeforePersisting(bool repairReferences, bool targetUsers)
    {
        var flag = NewFlag();
        if (targetUsers)
        {
            flag.DisabledVariationId = "on";
            flag.TargetUsers = new List<TargetUser> { new() { VariationId = "off", KeyIds = ["user"] } };
        }
        var next = flag.Clone();
        next.Variations = next.Variations.Where(x => x.Id != "off").ToList();
        if (repairReferences)
        {
            next.DisabledVariationId = "on";
            if (targetUsers) next.TargetUsers.Single().VariationId = "on";
        }
        var draft = new FlagDraft(flag.EnvId, flag.Id, new DataChange(flag).To(next), Guid.NewGuid());
        var flags = new Mock<IFeatureFlagService>();
        flags.Setup(x => x.GetAsync(flag.Id)).ReturnsAsync(flag);
        var drafts = new Mock<IFlagDraftService>();
        drafts.Setup(x => x.GetAsync(draft.Id)).ReturnsAsync(draft);
        var publisher = new Mock<IPublisher>();
        var sut = new FeatureFlagAppService(flags.Object, drafts.Object, Mock.Of<IAuditLogService>(),
            Mock.Of<ICacheService>(), publisher.Object);

        if (repairReferences)
        {
            await sut.ApplyDraftAsync(draft.Id, Operations.ApplyFlagSchedule, Guid.NewGuid());

            Assert.Equal("on", flag.DisabledVariationId);
            Assert.DoesNotContain(flag.Variations, x => x.Id == "off");
            Assert.DoesNotContain(flag.TargetUsers, x => x.VariationId == "off");
            Assert.True(draft.IsApplied());
            flags.Verify(x => x.UpdateAsync(flag), Times.Once);
        }
        else
        {
            await Assert.ThrowsAsync<ValidationException>(() =>
                sut.ApplyDraftAsync(draft.Id, Operations.ApplyFlagChangeRequest, Guid.NewGuid()));

            Assert.False(draft.IsApplied());
            flags.Verify(x => x.UpdateAsync(It.IsAny<FeatureFlag>()), Times.Never);
            drafts.Verify(x => x.UpdateAsync(It.IsAny<FlagDraft>()), Times.Never);
            publisher.Verify(x => x.Publish(It.IsAny<OnFeatureFlagChanged>(), It.IsAny<CancellationToken>()), Times.Never);
        }
    }

    [Fact]
    public async Task ApplyDraftAsync_DisabledVariationDeletedAfterReview_RejectsStaleDraft()
    {
        var flag = NewFlag();
        flag.DisabledVariationId = "on";
        var next = flag.Clone();
        next.DisabledVariationId = "off";
        var draft = new FlagDraft(flag.EnvId, flag.Id, new DataChange(flag).To(next), Guid.NewGuid());
        flag.Variations = flag.Variations.Where(x => x.Id != "off").ToList();
        var flags = new Mock<IFeatureFlagService>();
        flags.Setup(x => x.GetAsync(flag.Id)).ReturnsAsync(flag);
        var drafts = new Mock<IFlagDraftService>();
        drafts.Setup(x => x.GetAsync(draft.Id)).ReturnsAsync(draft);
        var publisher = new Mock<IPublisher>(MockBehavior.Strict);
        var sut = new FeatureFlagAppService(flags.Object, drafts.Object, Mock.Of<IAuditLogService>(),
            Mock.Of<ICacheService>(), publisher.Object);

        await Assert.ThrowsAsync<Application.Bases.Exceptions.ConflictException>(() =>
            sut.ApplyDraftAsync(draft.Id, Operations.ApplyFlagSchedule, Guid.NewGuid()));

        Assert.False(draft.IsApplied());
        flags.Verify(x => x.UpdateAsync(It.IsAny<FeatureFlag>()), Times.Never);
        drafts.Verify(x => x.UpdateAsync(It.IsAny<FlagDraft>()), Times.Never);
    }

    private static FeatureFlag NewFlag() => new(Guid.NewGuid(), "Flag", "", "flag", true,
        VariationTypes.String,
        new List<Variation>
        {
            new() { Id = "on", Name = "On", Value = "on" },
            new() { Id = "off", Name = "Off", Value = "off" }
        }, "off", "on", [], Guid.NewGuid());
}
