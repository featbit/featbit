using System.Linq.Expressions;
using Application.Services;
using Domain.FlagChangeRequests;
using Domain.FlagSchedules;
using Infrastructure.AppService;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Testing;
using Moq;

namespace Infrastructure.UnitTests.AppService;

public class FlagScheduleWorkerTests
{
    [Theory]
    [InlineData(FlagChangeRequestStatus.PendingReview, FlagScheduleStatus.PendingExecution, 0)]
    [InlineData(FlagChangeRequestStatus.Declined, FlagScheduleStatus.PendingExecution, 0)]
    [InlineData(FlagChangeRequestStatus.Approved, FlagScheduleStatus.PendingReview, 1)]
    [InlineData(FlagChangeRequestStatus.Applied, FlagScheduleStatus.PendingExecution, 0)]
    public async Task DoWorkAsync_LinkedRequest_UsesPersistedDecisionAsExecutionGate(
        string decision, string scheduleStatus, int applications)
    {
        var request = new FlagChangeRequest(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(),
            [Guid.NewGuid()], Guid.NewGuid(), status: decision) { Id = Guid.NewGuid() };
        var schedule = new FlagSchedule(request.OrgId, request.EnvId, request.FlagDraftId, request.FlagId,
            scheduleStatus, "Scheduled change", DateTime.UtcNow.AddMinutes(-1), request.CreatorId, request.Id)
            { Id = Guid.NewGuid() };
        var schedules = new Mock<IFlagScheduleService>();
        schedules.SetReturnsDefault(Task.FromResult(true));
        schedules.Setup(x => x.FindManyAsync(It.IsAny<Expression<Func<FlagSchedule, bool>>>()))
            .Returns((Expression<Func<FlagSchedule, bool>> predicate) => Task.FromResult<ICollection<FlagSchedule>>(
                new[] { schedule }.Where(predicate.Compile()).ToArray()));
        var requests = new Mock<IFlagChangeRequestService>();
        requests.Setup(x => x.GetAsync(request.Id)).ReturnsAsync(request);
        var app = new Mock<IFeatureFlagAppService>();
        await using var services = new ServiceCollection()
            .AddSingleton(schedules.Object).AddSingleton(requests.Object).AddSingleton(app.Object)
            .BuildServiceProvider();
        using var worker = new FlagScheduleWorker(services, new FakeLogger<FlagScheduleWorker>());

        await worker.DoWorkAsync(CancellationToken.None);
        await worker.StopAsync(CancellationToken.None);

        app.Verify(x => x.ApplyDraftAsync(schedule.FlagDraftId, It.IsAny<string>(), schedule.CreatorId),
            Times.Exactly(applications));
    }
}
