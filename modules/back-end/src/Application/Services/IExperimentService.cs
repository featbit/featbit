using Application.Bases.Models;
using Application.ExperimentMetrics;
using Application.Experiments;
using Domain.Experiments;

namespace Application.Services;

public interface IExperimentService : IService<Experiment>
{
    Task<IEnumerable<ExperimentStatusCountVm>> GetStatusCountAsync(Guid envId);
    
    Task<PagedResult<ExperimentVm>> GetListAsync(Guid envId, ExperimentFilter filter);

    Task<IEnumerable<ExperimentIterationResultsVm>> GetIterationResults(Guid envId, IEnumerable<ExperimentIterationParam> experimentIterationTuples);
    // Task<Experiment> GetAsync(Guid envId, string key);
    //
    // Task DeleteAsync(Guid id);
}