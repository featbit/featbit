using Application.FeatureFlags;
using Domain.FeatureFlags;

namespace Application.Services;

public interface IFeatureFlagInsightsService
{
    Task<ICollection<Insights>> GetFeatureFlagInsightsAsync(Guid envId, StatsByVariationFilter filter);
}
