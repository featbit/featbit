using Domain.FlagSchedules;
using Infrastructure.IntegrationTests.Fixtures;
using Infrastructure.Services.MongoDb;
using Infrastructure.Persistence.MongoDb;
using Microsoft.Extensions.Options;

namespace Infrastructure.IntegrationTests.Services.MongoDb;

[Collection(MongoCollection.Name)]
public class FlagScheduleServiceTests(MongoDbFixture fixture) : IntegrationTestBase
{
    [DockerTheory]
    [InlineData(FlagScheduleStatus.Declined)]
    [InlineData(FlagScheduleStatus.Applied)]
    public async Task TrySetReviewOutcomeAsync_TerminalSchedule_CannotReopenOrApply(string status)
    {
        var db = new MongoDbClient(Options.Create(new MongoDbOptions
        {
            ConnectionString = fixture.ConnectionString,
            Database = "schedule-review-" + Guid.NewGuid().ToString("N")
        }));
        var service = new FlagScheduleService(db);
        var requestId = Guid.NewGuid();
        var schedule = NewSchedule(requestId, status);
        await service.AddOneAsync(schedule);

        Assert.False(await service.TrySetReviewOutcomeAsync(schedule.Id, requestId, true, Guid.NewGuid()));
        Assert.False(await service.TryMarkAppliedAsync(schedule.Id, Guid.NewGuid()));
        Assert.Equal(status, (await service.GetAsync(schedule.Id)).Status);
    }

    [DockerFact]
    public async Task TrySetReviewOutcomeAsync_ApprovedSchedule_AdvancesOnceAndStaysApplied()
    {
        const string status = FlagScheduleStatus.PendingReview;
        var db = new MongoDbClient(Options.Create(new MongoDbOptions
        {
            ConnectionString = fixture.ConnectionString,
            Database = "schedule-review-" + Guid.NewGuid().ToString("N")
        }));
        var service = new FlagScheduleService(db);
        var requestId = Guid.NewGuid();
        var schedule = NewSchedule(requestId, status);
        await service.AddOneAsync(schedule);

        Assert.True(await service.TrySetReviewOutcomeAsync(schedule.Id, requestId, true, Guid.NewGuid()));
        Assert.True(await service.TryMarkAppliedAsync(schedule.Id, Guid.NewGuid()));
        Assert.False(await service.TrySetReviewOutcomeAsync(schedule.Id, requestId, true, Guid.NewGuid()));
        Assert.False(await service.TrySetReviewOutcomeAsync(schedule.Id, requestId, false, Guid.NewGuid()));
        Assert.Equal(FlagScheduleStatus.Applied, (await service.GetAsync(schedule.Id)).Status);
    }

    [DockerFact]
    public async Task TrySetReviewOutcomeAsync_WrongLinkedRequestOrNoApproval_DoesNotAdvance()
    {
        const string status = FlagScheduleStatus.PendingReview;
        var db = new MongoDbClient(Options.Create(new MongoDbOptions
        {
            ConnectionString = fixture.ConnectionString,
            Database = "schedule-review-" + Guid.NewGuid().ToString("N")
        }));
        var service = new FlagScheduleService(db);
        var requestId = Guid.NewGuid();
        var schedule = NewSchedule(requestId, status);
        await service.AddOneAsync(schedule);

        Assert.False(await service.TrySetReviewOutcomeAsync(schedule.Id, Guid.NewGuid(), true, Guid.NewGuid()));
        Assert.False(await service.TryMarkAppliedAsync(schedule.Id, Guid.NewGuid()));
        Assert.Equal(FlagScheduleStatus.PendingReview, (await service.GetAsync(schedule.Id)).Status);
    }

    [DockerFact]
    public async Task TrySetReviewOutcomeAsync_DeclinedRequestOnStaleExecutableSchedule_StopsExecution()
    {
        const string status = FlagScheduleStatus.PendingExecution;
        var db = new MongoDbClient(Options.Create(new MongoDbOptions
        {
            ConnectionString = fixture.ConnectionString,
            Database = "schedule-review-" + Guid.NewGuid().ToString("N")
        }));
        var service = new FlagScheduleService(db);
        var requestId = Guid.NewGuid();
        var schedule = NewSchedule(requestId, status);
        await service.AddOneAsync(schedule);

        Assert.True(await service.TrySetReviewOutcomeAsync(schedule.Id, requestId, false, Guid.NewGuid()));
        Assert.False(await service.TryMarkAppliedAsync(schedule.Id, Guid.NewGuid()));
        Assert.False(await service.TrySetReviewOutcomeAsync(schedule.Id, requestId, true, Guid.NewGuid()));
        Assert.Equal(FlagScheduleStatus.Declined, (await service.GetAsync(schedule.Id)).Status);
    }

    private static FlagSchedule NewSchedule(Guid requestId, string status) => new(Guid.NewGuid(), Guid.NewGuid(),
        Guid.NewGuid(), Guid.NewGuid(), status, "Scheduled change", DateTime.UtcNow.AddMinutes(-1), Guid.NewGuid(), requestId)
        { Id = Guid.NewGuid() };
}
