using Domain.Experiments;

namespace Application.Services;

public interface IOlapService
{
    Task<ExperimentIteration> GetExptIterationResultAsync(ExptIterationParam param);
}