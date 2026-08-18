using Application.FeatureFlags;
using Application.Insights;

namespace Application.Services;

public interface IInsightService
{
    Task AddManyAsync(object[] insights);

    Task<ICollection<Insight>> GetInsightsAsync(Guid envId, InsightFilter filter);
}
