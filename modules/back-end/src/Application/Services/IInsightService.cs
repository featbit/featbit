using Application.FeatureFlags;
using Domain.FeatureFlags;

namespace Application.Services;

public interface IInsightService
{
    bool TryParse(string json, out object insight);

    Task AddManyAsync(object[] insights);

    Task<ICollection<Insights>> GetInsightsAsync(Guid envId, InsightFilter filter);
}
