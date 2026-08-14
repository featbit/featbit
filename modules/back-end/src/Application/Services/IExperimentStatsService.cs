using Application.ExperimentStats;

namespace Application.Services;

public interface IExperimentStatsService
{
    Task<ExperimentStatsVm> QueryAsync(QueryExperimentStats request);
}
