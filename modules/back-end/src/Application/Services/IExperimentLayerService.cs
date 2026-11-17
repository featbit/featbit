using Application.Bases.Models;
using Application.Experiments.ExperimentLayers;
using Domain.Experiments;

namespace Application.Services;

public interface IExperimentLayerService
{
    Task<PagedResult<ExperimentLayer>> GetListAsync(
        Guid envId,
        ExperimentLayerFilter filter);

    Task<ExperimentLayer> CreateAsync(
        Guid envId,
        CreateExperimentLayerRequest request);

    Task<ExperimentLayer> UpdateAsync(
        Guid envId,
        Guid id,
        UpdateExperimentLayerRequest request);

    Task ArchiveAsync(Guid envId, Guid id);

    Task RestoreAsync(Guid envId, Guid id);
}
