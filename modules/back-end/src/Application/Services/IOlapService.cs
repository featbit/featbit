using Domain.Experiments;
using Domain.FeatureFlags;

namespace Application.Services;

public interface IOlapService
{
    Task<FeatureFlagEndUserStats> GetFeatureFlagEndUserStats(FeatureFlagEndUserParam param);
    Task<ICollection<Insights>> GetFeatureFlagInsights(InsightsParam param);
    Task<ExperimentIteration> GetExptIterationResultAsync(ExptIterationParam param);
}