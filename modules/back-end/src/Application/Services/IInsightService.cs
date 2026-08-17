using Application.FeatureFlags;
using Application.Insights;

namespace Application.Services;

public interface IInsightService
{
    bool TryParse(string json, out object insight);

    Task AddManyAsync(object[] insights);

    Task<ICollection<Insight>> GetInsightsAsync(Guid envId, InsightFilter filter);
}
