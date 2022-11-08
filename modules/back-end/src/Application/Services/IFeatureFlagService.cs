using Application.Bases.Models;
using Application.FeatureFlags;
using Domain.FeatureFlags;

namespace Application.Services;

public interface IFeatureFlagService : IService<FeatureFlag>
{
    Task<ICollection<FeatureFlagStats>> GetStatsByVariationAsync(Guid envId, StatsByVariationFilter filter);
    Task<PagedResult<FeatureFlag>> GetListAsync(Guid envId, FeatureFlagFilter filter);

    Task<FeatureFlag> GetAsync(Guid envId, string key);

    Task DeleteAsync(Guid id);

    Task<ICollection<string>> GetAllTagsAsync(Guid envId);
}