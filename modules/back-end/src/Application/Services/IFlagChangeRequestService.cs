using Domain.FlagChangeRequests;

namespace Application.Services;

public interface IFlagChangeRequestService : IService<FlagChangeRequest>
{
    Task DeleteAsync(Guid id);
}