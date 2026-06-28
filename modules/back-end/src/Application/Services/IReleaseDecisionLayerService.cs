using Application.Bases.Models;
using Application.ReleaseDecisions;

namespace Application.Services;

public interface IReleaseDecisionLayerService
{
    Task<PagedResult<ReleaseDecisionLayerVm>> GetListAsync(
        Guid envId,
        ReleaseDecisionLayerFilter filter);

    Task<ReleaseDecisionLayerVm> CreateAsync(
        Guid envId,
        ReleaseDecisionLayerUpdate update);

    Task<ReleaseDecisionLayerVm> UpdateAsync(
        Guid envId,
        Guid id,
        ReleaseDecisionLayerUpdate update);

    Task ArchiveAsync(Guid envId, Guid id);
}
