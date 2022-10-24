using Application.Bases.Models;
using Application.ExperimentMetrics;
using Domain.ExperimentMetrics;

namespace Application.Services;

public interface IExperimentMetricService : IService<ExperimentMetric>
{
    Task<PagedResult<ExperimentMetric>> GetListAsync(Guid envId, ExperimentMetricFilter filter);
}