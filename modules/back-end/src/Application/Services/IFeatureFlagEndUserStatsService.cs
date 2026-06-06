using Domain.FeatureFlags;

namespace Application.Services;

public interface IFeatureFlagEndUserStatsService
{
    Task<FeatureFlagEndUserStats> GetFeatureFlagEndUserStatsAsync(FeatureFlagEndUserParam param);
}
