using Domain.FlagSchedules;

namespace Application.Services;

public interface IFlagScheduleService : IService<FlagSchedule>
{
    Task DeleteAsync(Guid id);
}