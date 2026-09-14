using Application.Bases.Models;
using Application.Experiments.ExperimentMetrics;
using Domain.Experiments;

namespace Application.Services;

public interface IExperimentMetricService
{
    Task<PagedResult<ExperimentMetric>> GetListAsync(
        Guid envId,
        ExperimentMetricFilter filter,
        IReadOnlyCollection<string> referencedKeys);

    Task<ExperimentMetric> CreateAsync(
        Guid envId,
        CreateExperimentMetricRequest request);

    Task<ExperimentMetric> UpdateAsync(
        Guid envId,
        Guid id,
        UpdateExperimentMetricRequest request);

    Task ArchiveAsync(Guid envId, Guid id);

    Task RestoreAsync(Guid envId, Guid id);

    Task<ExperimentMetric> GetBySelectorAsync(
        Guid envId,
        Guid? id,
        string key);
}
