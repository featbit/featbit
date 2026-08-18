using Application.Bases.Models;
using Application.Experiments;

namespace Application.Services;

public interface IExperimentMetricService
{
    Task<PagedResult<ExperimentMetricVm>> GetListAsync(
        Guid envId,
        ExperimentMetricFilter filter);

    Task<ExperimentMetricVm> CreateAsync(
        Guid envId,
        ExperimentMetricUpdate update);

    Task<ExperimentMetricVm> UpdateAsync(
        Guid envId,
        Guid id,
        ExperimentMetricUpdate update);

    Task ArchiveAsync(Guid envId, Guid id);

    Task<ExperimentMetricVm> GetBySelectorAsync(
        Guid envId,
        Guid? id,
        string key);
}
