using Application.ChangeRequests;
using Domain.FlagChangeRequests;

namespace Application.Services;

public interface IFlagChangeRequestService : IService<FlagChangeRequest>
{
    Task<FlagChangeRequestPage> GetListAsync(
        Guid orgId,
        Guid envId,
        Guid currentUserId,
        ChangeRequestFilter filter
    );
}
