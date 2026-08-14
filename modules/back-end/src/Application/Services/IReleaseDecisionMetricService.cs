using Application.Bases.Models;
using Application.ReleaseDecisions;

namespace Application.Services;

public interface IReleaseDecisionMetricService
{
    Task<PagedResult<ReleaseDecisionMetricVm>> GetListAsync(
        Guid envId,
        ReleaseDecisionMetricFilter filter);

    Task<ReleaseDecisionMetricVm> CreateAsync(
        Guid envId,
        ReleaseDecisionMetricUpdate update);

    Task<ReleaseDecisionMetricVm> UpdateAsync(
        Guid envId,
        Guid id,
        ReleaseDecisionMetricUpdate update);

    Task ArchiveAsync(Guid envId, Guid id);

    Task<ReleaseDecisionMetricVm> GetBySelectorAsync(
        Guid envId,
        Guid? id,
        string key);
}
