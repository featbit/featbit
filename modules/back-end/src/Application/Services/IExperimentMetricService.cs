using Application.Bases.Models;
using Application.Experiments;
using Domain.Experiments;

namespace Application.Services;

public interface IExperimentMetricService : IService<ExperimentMetric>
{
    Task<PagedResult<ExperimentMetric>> GetListAsync(Guid envId, ExperimentMetricFilter filter);
    Task DeleteAsync(Guid id);
}