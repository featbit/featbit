using Application.Bases.Exceptions;
using Application.Services;
using Domain.FlagChangeRequests;
using Infrastructure.IntegrationTests.Fixtures;
using Infrastructure.Services.EntityFrameworkCore;

namespace Infrastructure.IntegrationTests.Services.EntityFrameworkCore;

[Collection(FeatBitPostgresCollection.Name)]
public class FlagChangeRequestServiceTests(FeatBitPostgresFixture fixture) : IntegrationTestBase
{
    [DockerFact]
    public async Task UpdateAsync_ConcurrentReviewDecisions_OnlyOneCanCommit()
    {
        await using var firstDb = AppDbContextFactory.Create(fixture.ConnectionString);
        await using var secondDb = AppDbContextFactory.Create(fixture.ConnectionString);
        var firstService = new FlagChangeRequestService(firstDb);
        var secondService = new FlagChangeRequestService(secondDb);
        var request = NewRequest();
        await firstService.AddOneAsync(request);
        firstDb.ChangeTracker.Clear();
        var first = await firstService.GetAsync(request.Id);
        var second = await secondService.GetAsync(request.Id);
        first.Approve(request.Reviewers.First().MemberId);
        second.Decline(request.Reviewers.Last().MemberId);
        var release = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var writers = new[] { SaveAsync(firstService, first), SaveAsync(secondService, second) };
        release.SetResult();

        var results = await Task.WhenAll(writers).WaitAsync(TimeSpan.FromSeconds(10));

        Assert.Single(results, error => error == null);
        Assert.IsType<ConflictException>(Assert.Single(results, error => error != null));
        return;

        async Task<Exception?> SaveAsync(IFlagChangeRequestService service, FlagChangeRequest value)
        {
            await release.Task;
            return await Record.ExceptionAsync(() => service.UpdateAsync(value));
        }
    }

    [DockerFact]
    public async Task UpdateAsync_DeclineCommittedBeforeStaleApproval_CannotReopenDecision()
    {
        await using var firstDb = AppDbContextFactory.Create(fixture.ConnectionString);
        await using var secondDb = AppDbContextFactory.Create(fixture.ConnectionString);
        var firstService = new FlagChangeRequestService(firstDb);
        var secondService = new FlagChangeRequestService(secondDb);
        var request = NewRequest();
        await firstService.AddOneAsync(request);
        firstDb.ChangeTracker.Clear();
        var decline = await firstService.GetAsync(request.Id);
        var stale = await secondService.GetAsync(request.Id);
        decline.Decline(request.Reviewers.First().MemberId);
        stale.Approve(request.Reviewers.Last().MemberId);
        await firstService.UpdateAsync(decline);

        await Assert.ThrowsAsync<ConflictException>(() => secondService.UpdateAsync(stale));

        Assert.Equal(FlagChangeRequestStatus.Declined, (await firstService.GetAsync(request.Id)).Status);
    }

    [DockerFact]
    public async Task UpdateAsync_StaleScheduleLink_PreservesTheCommittedDecision()
    {
        await using var firstDb = AppDbContextFactory.Create(fixture.ConnectionString);
        await using var secondDb = AppDbContextFactory.Create(fixture.ConnectionString);
        var firstService = new FlagChangeRequestService(firstDb);
        var secondService = new FlagChangeRequestService(secondDb);
        var request = NewRequest();
        await firstService.AddOneAsync(request);
        firstDb.ChangeTracker.Clear();
        var approval = await firstService.GetAsync(request.Id);
        var staleLink = await secondService.GetAsync(request.Id);
        approval.Approve(request.Reviewers.First().MemberId);
        await firstService.UpdateAsync(approval);
        var schedule = Guid.NewGuid();
        staleLink.AttachSchedule(schedule);

        await secondService.UpdateAsync(staleLink);

        var stored = await firstService.GetAsync(request.Id);
        Assert.Equal(FlagChangeRequestStatus.Approved, stored.Status);
        Assert.Equal(FlagChangeRequestAction.Approve, stored.Reviewers.First().Action);
        Assert.Equal(schedule, stored.ScheduleId);
    }

    private static FlagChangeRequest NewRequest() => new(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(),
        Guid.NewGuid(), [Guid.NewGuid(), Guid.NewGuid()], Guid.NewGuid()) { Id = Guid.NewGuid() };
}
