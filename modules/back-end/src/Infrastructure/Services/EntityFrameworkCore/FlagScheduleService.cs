using Domain.FlagChangeRequests;
using Domain.FlagSchedules;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Services.EntityFrameworkCore;

public class FlagScheduleService(AppDbContext dbContext)
    : EntityFrameworkCoreService<FlagSchedule>(dbContext), IFlagScheduleService
{
    public async Task DeleteAsync(Guid id)
    {
        await DeleteOneAsync(id);

        // delete related flag change requests
        await SetOf<FlagChangeRequest>().Where(x => x.ScheduleId == id).ExecuteDeleteAsync();
    }
}