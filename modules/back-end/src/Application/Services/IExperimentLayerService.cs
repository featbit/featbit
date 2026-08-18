using Application.Bases.Models;
using Application.Experiments;

namespace Application.Services;

public interface IExperimentLayerService
{
    Task<PagedResult<ExperimentLayerVm>> GetListAsync(
        Guid envId,
        ExperimentLayerFilter filter);

    Task<ExperimentLayerVm> CreateAsync(
        Guid envId,
        ExperimentLayerUpdate update);

    Task<ExperimentLayerVm> UpdateAsync(
        Guid envId,
        Guid id,
        ExperimentLayerUpdate update);

    Task ArchiveAsync(Guid envId, Guid id);
}
