using System.Text.Json;
using Application.Bases.Exceptions;
using Application.Caches;
using Application.Experiments;
using Application.Services;
using Domain.AuditLogs;
using Domain.FeatureFlags;
using Domain.FlagDrafts;
using Domain.Utils;
using Infrastructure.AppService;
using MediatR;
using Moq;

namespace Infrastructure.UnitTests.AppService;

public class FeatureFlagAppServiceTests
{
    private readonly Mock<IFeatureFlagService> _flagService = new();
    private readonly Mock<IFlagDraftService> _flagDraftService = new();
    private readonly Mock<IPublisher> _publisher = new();
    private readonly Mock<IFlagInsightsGuard> _insightsGuard = new();
    private readonly FeatureFlagAppService _sut;

    public FeatureFlagAppServiceTests()
    {
        _sut = new FeatureFlagAppService(
            _flagService.Object,
            _flagDraftService.Object,
            Mock.Of<IAuditLogService>(),
            Mock.Of<ICacheService>(),
            _publisher.Object,
            _insightsGuard.Object);
    }

    private static FeatureFlag Flag() => new()
    {
        Id = Guid.NewGuid(),
        EnvId = Guid.NewGuid(),
        Name = "flag",
        Key = "flag",
        Tags = [],
        Variations = [new Variation { Id = "v1", Name = "v1", Value = "true" }],
        DisabledVariationId = "v1",
        TargetUsers = [],
        Rules = [],
        Fallthrough = new Fallthrough { Variations = [] },
        InsightsEnabled = true
    };

    private static FlagDraft DisableInsightsDraft(FeatureFlag flag)
    {
        var previous = JsonSerializer.Serialize(flag, ReusableJsonSerializerOptions.Web);
        var target = flag.Clone();
        target.InsightsEnabled = false;
        var current = JsonSerializer.Serialize(target, ReusableJsonSerializerOptions.Web);

        return new FlagDraft(flag.EnvId, flag.Id, new DataChange { Previous = previous, Current = current }, Guid.NewGuid());
    }

    [Fact]
    public async Task ApplyDraftAsync_GuardRejects_DoesNotPersistOrMarkApplied()
    {
        var flag = Flag();
        var draft = DisableInsightsDraft(flag);
        _flagDraftService.Setup(x => x.GetAsync(draft.Id)).ReturnsAsync(draft);
        _flagService.Setup(x => x.GetAsync(draft.FlagId)).ReturnsAsync(flag);
        _insightsGuard
            .Setup(x => x.EnsureCanDisableInsightsAsync(true, flag))
            .ThrowsAsync(new InsightsRequiredByExperimentException([new ExperimentRef(Guid.NewGuid(), "expt")]));

        await Assert.ThrowsAsync<InsightsRequiredByExperimentException>(
            () => _sut.ApplyDraftAsync(draft.Id, Operations.ApplyFlagSchedule, Guid.NewGuid()));

        Assert.Equal(FlagDraftStatus.Pending, draft.Status);
        _flagService.Verify(x => x.UpdateAsync(It.IsAny<FeatureFlag>()), Times.Never);
        _flagDraftService.Verify(x => x.UpdateAsync(It.IsAny<FlagDraft>()), Times.Never);
    }

    [Fact]
    public async Task ApplyDraftAsync_GuardAllows_AppliesDraft()
    {
        var flag = Flag();
        var draft = DisableInsightsDraft(flag);
        _flagDraftService.Setup(x => x.GetAsync(draft.Id)).ReturnsAsync(draft);
        _flagService.Setup(x => x.GetAsync(draft.FlagId)).ReturnsAsync(flag);

        await _sut.ApplyDraftAsync(draft.Id, Operations.ApplyFlagSchedule, Guid.NewGuid());

        Assert.False(flag.InsightsEnabled);
        Assert.Equal(FlagDraftStatus.Applied, draft.Status);
        _insightsGuard.Verify(x => x.EnsureCanDisableInsightsAsync(true, flag), Times.Once);
        _flagService.Verify(x => x.UpdateAsync(flag), Times.Once);
    }
}
