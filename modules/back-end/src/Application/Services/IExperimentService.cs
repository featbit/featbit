using Application.Bases.Models;
using Application.Experiments;
using Domain.Experiments;

namespace Application.Services;

public interface IExperimentService : IService<Experiment>
{
    Task<PagedResult<ExperimentVm>> GetListAsync(Guid envId, ExperimentFilter filter);

    // Task<Experiment> GetAsync(Guid envId, string key);
    //
    // Task DeleteAsync(Guid id);
}