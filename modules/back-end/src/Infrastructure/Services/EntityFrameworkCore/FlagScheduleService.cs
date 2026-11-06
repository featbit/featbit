using Domain.FlagChangeRequests;
using Domain.FlagSchedules;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Services.EntityFrameworkCore;

public class FlagScheduleService(AppDbContext dbContext)
    : EntityFrameworkCoreService<FlagSchedule>(dbContext), IFlagScheduleService
{
    public async Task<bool> TrySetReviewOutcomeAsync(Guid id, Guid changeRequestId, bool approved, Guid operatorId)
    {
        var status = approved ? FlagScheduleStatus.PendingExecution : FlagScheduleStatus.Declined;
        var changed = await Set.Where(x => x.Id == id && x.ChangeRequestId == changeRequestId &&
                (x.Status == FlagScheduleStatus.PendingReview || (!approved && x.Status == FlagScheduleStatus.PendingExecution)))
            .ExecuteUpdateAsync(setters => setters.SetProperty(x => x.Status, status)
                .SetProperty(x => x.UpdatedAt, DateTime.UtcNow).SetProperty(x => x.UpdatorId, operatorId));
        return changed == 1;
    }

    public async Task<bool> TryMarkAppliedAsync(Guid id, Guid operatorId)
    {
        var changed = await Set.Where(x => x.Id == id && x.Status == FlagScheduleStatus.PendingExecution)
            .ExecuteUpdateAsync(setters => setters.SetProperty(x => x.Status, FlagScheduleStatus.Applied)
                .SetProperty(x => x.UpdatedAt, DateTime.UtcNow).SetProperty(x => x.UpdatorId, operatorId));
        return changed == 1;
    }

    public async Task DeleteAsync(Guid id)
    {
        await DeleteOneAsync(id);

        // delete related flag change requests
        await SetOf<FlagChangeRequest>().Where(x => x.ScheduleId == id).ExecuteDeleteAsync();
    }
}
