using Application.EndUsers;

namespace Application.Services;

public interface IEndUserStatsService
{
    Task<EndUserStats> GetEndUserStatsAsync(Guid envId, EndUserStatsFilter filter);
}
