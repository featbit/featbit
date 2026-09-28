using System.Linq.Expressions;
using Application.Bases.Exceptions;
using Application.Experiments;
using Application.Services;
using Domain.FlagSchedules;
using Infrastructure.AppService;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Testing;
using Moq;

namespace Infrastructure.UnitTests.AppService;

public class FlagScheduleWorkerTests
{
    private readonly Mock<IFlagScheduleService> _scheduleService = new();
    private readonly Mock<IFeatureFlagAppService> _flagAppService = new();
    private readonly FakeLogger<FlagScheduleWorker> _logger = new();
    private readonly FlagScheduleWorker _sut;

    public FlagScheduleWorkerTests()
    {
        var services = new ServiceCollection()
            .AddSingleton(_scheduleService.Object)
            .AddSingleton(_flagAppService.Object)
            .AddSingleton(Mock.Of<IFlagChangeRequestService>())
            .BuildServiceProvider();

        _sut = new FlagScheduleWorker(services, _logger);
    }

    private FlagSchedule DueSchedule()
    {
        var schedule = new FlagSchedule(
            Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(),
            FlagScheduleStatus.PendingExecution, "disable insights", DateTime.UtcNow.AddMinutes(-1),
            Guid.NewGuid(), changeRequestId: null);

        _scheduleService
            .Setup(x => x.FindManyAsync(It.IsAny<Expression<Func<FlagSchedule, bool>>>()))
            .ReturnsAsync([schedule]);

        return schedule;
    }

    [Fact]
    public async Task DoWorkAsync_InsightsRequiredByExperiment_MarksScheduleFailed()
    {
        var schedule = DueSchedule();
        _flagAppService
            .Setup(x => x.ApplyDraftAsync(schedule.FlagDraftId, It.IsAny<string>(), It.IsAny<Guid>()))
            .ThrowsAsync(new InsightsRequiredByExperimentException([new ExperimentRef(Guid.NewGuid(), "expt")]));

        await _sut.DoWorkAsync(CancellationToken.None);

        Assert.Equal(FlagScheduleStatus.Failed, schedule.Status);
        _scheduleService.Verify(x => x.UpdateAsync(schedule), Times.Once);
        Assert.Equal(LogLevel.Warning, _logger.LatestRecord.Level);
    }

    [Fact]
    public async Task DoWorkAsync_OtherFailure_LeavesSchedulePendingForRetry()
    {
        var schedule = DueSchedule();
        _flagAppService
            .Setup(x => x.ApplyDraftAsync(schedule.FlagDraftId, It.IsAny<string>(), It.IsAny<Guid>()))
            .ThrowsAsync(new InvalidOperationException("store down"));

        await _sut.DoWorkAsync(CancellationToken.None);

        Assert.Equal(FlagScheduleStatus.PendingExecution, schedule.Status);
        _scheduleService.Verify(x => x.UpdateAsync(It.IsAny<FlagSchedule>()), Times.Never);
        Assert.Equal(LogLevel.Error, _logger.LatestRecord.Level);
    }
}
