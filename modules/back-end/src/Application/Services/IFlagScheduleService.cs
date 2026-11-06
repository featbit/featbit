using Domain.FlagSchedules;

namespace Application.Services;

public interface IFlagScheduleService : IService<FlagSchedule>
{
    Task DeleteAsync(Guid id);

    Task<bool> TrySetReviewOutcomeAsync(Guid id, Guid changeRequestId, bool approved, Guid operatorId);

    Task<bool> TryMarkAppliedAsync(Guid id, Guid operatorId);
}
