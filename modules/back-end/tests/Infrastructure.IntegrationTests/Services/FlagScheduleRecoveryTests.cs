using Application.Services;
using Domain.FlagChangeRequests;
using Domain.FlagSchedules;
using Domain.Segments;
using Infrastructure.AppService;
using Infrastructure.IntegrationTests.Fixtures;
using Infrastructure.Persistence.EntityFrameworkCore;
using Infrastructure.Persistence.MongoDb;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Testing;
using Microsoft.Extensions.Options;

namespace Infrastructure.IntegrationTests.Services;

public abstract class FlagScheduleRecoveryTests : IntegrationTestBase
{
    protected abstract Task<ServiceProvider> CreateServicesAsync();

    [DockerTheory]
    [InlineData(FlagChangeRequestStatus.PendingReview, FlagScheduleStatus.PendingExecution, FlagScheduleStatus.PendingExecution, 0)]
    [InlineData(FlagChangeRequestStatus.Declined, FlagScheduleStatus.PendingExecution, FlagScheduleStatus.Declined, 0)]
    [InlineData(FlagChangeRequestStatus.Approved, FlagScheduleStatus.PendingReview, FlagScheduleStatus.Applied, 1)]
    [InlineData(FlagChangeRequestStatus.Applied, FlagScheduleStatus.PendingReview, FlagScheduleStatus.Applied, 0)]
    [InlineData(FlagChangeRequestStatus.Applied, FlagScheduleStatus.PendingExecution, FlagScheduleStatus.Applied, 0)]
    public async Task InterruptedProjection_RepairsPersistedState_AndSecondTickDoesNotReapply(
        string decision, string scheduleStatus, string expectedSchedule, int executions)
    {
        await using var services = await CreateServicesAsync();
        var request = new FlagChangeRequest(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(),
            [Guid.NewGuid()], Guid.NewGuid(), status: decision) { Id = Guid.NewGuid() };
        var schedule = new FlagSchedule(request.OrgId, request.EnvId, request.FlagDraftId, request.FlagId,
            scheduleStatus, "interrupted projection", DateTime.UtcNow.AddMinutes(-1), request.CreatorId, request.Id)
            { Id = Guid.NewGuid() };
        using (var seed = services.CreateScope())
        {
            await seed.ServiceProvider.GetRequiredService<IFlagChangeRequestService>().AddOneAsync(request);
            await seed.ServiceProvider.GetRequiredService<IFlagScheduleService>().AddOneAsync(schedule);
        }
        var app = services.GetRequiredService<RecordingAppService>();
        using var worker = new FlagScheduleWorker(services, new FakeLogger<FlagScheduleWorker>());
        try
        {
            await worker.DoWorkAsync(CancellationToken.None);
            await AssertStateAsync();
            await worker.DoWorkAsync(CancellationToken.None);
            await AssertStateAsync();
        }
        finally { await worker.StopAsync(CancellationToken.None); }

        async Task AssertStateAsync()
        {
            using var read = services.CreateScope();
            var storedSchedule = await read.ServiceProvider.GetRequiredService<IFlagScheduleService>().GetAsync(schedule.Id);
            var storedRequest = await read.ServiceProvider.GetRequiredService<IFlagChangeRequestService>().GetAsync(request.Id);
            Assert.Equal(expectedSchedule, storedSchedule.Status);
            Assert.Equal(decision == FlagChangeRequestStatus.Approved ? FlagChangeRequestStatus.Applied : decision,
                storedRequest.Status);
            Assert.Equal(executions, app.Drafts.Count);
            if (executions > 0) Assert.Equal(schedule.FlagDraftId, app.Drafts.Single());
        }
    }

    protected static IServiceCollection Common() => new ServiceCollection()
        .AddSingleton<RecordingAppService>()
        .AddSingleton<IFeatureFlagAppService>(sp => sp.GetRequiredService<RecordingAppService>());

    // The draft execution boundary is counted; review and schedule transitions use the real stores.
    protected sealed class RecordingAppService : IFeatureFlagAppService
    {
        public List<Guid> Drafts { get; } = [];
        public Task ApplyDraftAsync(Guid draftId, string operation, Guid operatorId)
        { Drafts.Add(draftId); return Task.CompletedTask; }
        public Task OnSegmentUpdatedAsync(Segment segment, Guid operatorId, ICollection<FlagReference> flags) =>
            throw new InvalidOperationException("not used by schedule recovery");
    }
}

[Collection(MongoCollection.Name)]
public sealed class MongoFlagScheduleRecoveryTests(MongoDbFixture fixture) : FlagScheduleRecoveryTests
{
    protected override Task<ServiceProvider> CreateServicesAsync()
    {
        var client = new MongoDbClient(Options.Create(new MongoDbOptions
        { ConnectionString = fixture.ConnectionString, Database = "schedule-recovery-" + Guid.NewGuid().ToString("N") }));
        return Task.FromResult(Common()
            .AddScoped<IFlagScheduleService>(_ => new Infrastructure.Services.MongoDb.FlagScheduleService(client))
            .AddScoped<IFlagChangeRequestService>(_ => new Infrastructure.Services.MongoDb.FlagChangeRequestService(client))
            .BuildServiceProvider());
    }
}

[Collection(FeatBitPostgresCollection.Name)]
public sealed class PostgresFlagScheduleRecoveryTests(FeatBitPostgresFixture fixture) : FlagScheduleRecoveryTests
{
    protected override async Task<ServiceProvider> CreateServicesAsync()
    {
        await using (var cleanup = AppDbContextFactory.Create(fixture.ConnectionString))
            await cleanup.Database.ExecuteSqlRawAsync("TRUNCATE flag_schedules, flag_change_requests;");
        return Common().AddScoped<AppDbContext>(_ => AppDbContextFactory.Create(fixture.ConnectionString))
            .AddScoped<IFlagScheduleService, Infrastructure.Services.EntityFrameworkCore.FlagScheduleService>()
            .AddScoped<IFlagChangeRequestService, Infrastructure.Services.EntityFrameworkCore.FlagChangeRequestService>()
            .BuildServiceProvider();
    }
}
