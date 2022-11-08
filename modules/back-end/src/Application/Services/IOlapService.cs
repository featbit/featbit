using Domain.Experiments;
using Domain.FeatureFlags;

namespace Application.Services;

public interface IOlapService
{
    Task<ICollection<FeatureFlagStats>> GetFeatureFlagStatusByVariation(StatsByVariationParam param);
    Task<ExperimentIteration> GetExptIterationResultAsync(ExptIterationParam param);
}