using Application.Bases.Models;
using Application.ExperimentMetrics;
using Application.Experiments;
using Domain.Experiments;

namespace Application.Services;

public interface IExperimentService : IService<Experiment>
{
    Task ArchiveExperiment(Guid envId, Guid experimentId);
    
    Task StopExperiment(Guid envId, Guid experimentId);
    
    Task ArchiveIterations(Guid envId, Guid experimentId);
    
    Task<ExperimentIteration> StartExperiment(Guid envId, Guid experimentId);
    
    Task<IEnumerable<ExperimentStatusCountVm>> GetStatusCountAsync(Guid envId);
    
    Task<PagedResult<ExperimentVm>> GetListAsync(Guid envId, ExperimentFilter filter);

    Task<IEnumerable<ExperimentIterationResultsVm>> GetIterationResults(Guid envId, IEnumerable<ExperimentIterationParam> experimentIterationTuples);
}