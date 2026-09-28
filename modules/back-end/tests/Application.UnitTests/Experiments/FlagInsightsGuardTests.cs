using Application.Bases;
using Application.Bases.Exceptions;
using Application.Experiments;
using Application.Services;
using Domain.FeatureFlags;
using Microsoft.Extensions.Time.Testing;

namespace Application.UnitTests.Experiments;

public class FlagInsightsGuardTests
{
    private readonly Mock<IExperimentService> _experimentService = new();
    private readonly FakeTimeProvider _timeProvider = new(new DateTimeOffset(2026, 9, 23, 12, 0, 0, TimeSpan.Zero));
    private readonly FlagInsightsGuard _guard;

    public FlagInsightsGuardTests()
    {
        _guard = new FlagInsightsGuard(_experimentService.Object, _timeProvider);
    }

    private static FeatureFlag Flag(bool insightsEnabled) => new()
    {
        Id = Guid.NewGuid(),
        EnvId = Guid.NewGuid(),
        InsightsEnabled = insightsEnabled
    };

    [Fact]
    public async Task EnsureCanDisableInsightsAsync_RunningExperiment_ThrowsWithExperiments()
    {
        var after = Flag(insightsEnabled: false);
        var running = new[] { new ExperimentRef(Guid.NewGuid(), "Checkout copy test") };
        _experimentService
            .Setup(x => x.GetRunningForFlagAsync(after.EnvId, after.Id, _timeProvider.GetUtcNow().UtcDateTime))
            .ReturnsAsync(running);

        var ex = await Assert.ThrowsAsync<InsightsRequiredByExperimentException>(
            () => _guard.EnsureCanDisableInsightsAsync(wasEnabled: true, after));

        Assert.Equal(running, ex.Experiments);
        Assert.Equal(ErrorCodes.InsightsRequiredByRunningExperiment, ex.Message);
    }

    [Fact]
    public async Task EnsureCanDisableInsightsAsync_NoRunningExperiment_DoesNotThrow()
    {
        var after = Flag(insightsEnabled: false);
        _experimentService
            .Setup(x => x.GetRunningForFlagAsync(It.IsAny<Guid>(), It.IsAny<Guid>(), It.IsAny<DateTime>()))
            .ReturnsAsync([]);

        await _guard.EnsureCanDisableInsightsAsync(wasEnabled: true, after);

        _experimentService.Verify(
            x => x.GetRunningForFlagAsync(after.EnvId, after.Id, It.IsAny<DateTime>()), Times.Once);
    }

    [Theory]
    [InlineData(false, true)]
    [InlineData(false, false)]
    [InlineData(true, true)]
    public async Task EnsureCanDisableInsightsAsync_NotTurningOff_SkipsLookup(bool wasEnabled, bool isEnabled)
    {
        await _guard.EnsureCanDisableInsightsAsync(wasEnabled, Flag(isEnabled));

        _experimentService.Verify(
            x => x.GetRunningForFlagAsync(It.IsAny<Guid>(), It.IsAny<Guid>(), It.IsAny<DateTime>()), Times.Never);
    }

    [Fact]
    public async Task EnsureCanDisableInsightsAsync_BeforeAndAfterOverload_UsesBeforeValue()
    {
        var before = Flag(insightsEnabled: true);
        var after = Flag(insightsEnabled: false);
        _experimentService
            .Setup(x => x.GetRunningForFlagAsync(It.IsAny<Guid>(), It.IsAny<Guid>(), It.IsAny<DateTime>()))
            .ReturnsAsync([new ExperimentRef(Guid.NewGuid(), "e")]);

        await Assert.ThrowsAsync<InsightsRequiredByExperimentException>(
            () => _guard.EnsureCanDisableInsightsAsync(before, after));
    }
}
