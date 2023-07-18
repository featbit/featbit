using Application.Bases.Models;
using Application.FeatureFlags;
using Domain.FeatureFlags;

namespace Application.Services;

public interface IFeatureFlagService : IService<FeatureFlag>
{
    Task<PagedResult<FeatureFlag>> GetListAsync(Guid envId, FeatureFlagFilter filter);

    Task<FeatureFlag> GetAsync(Guid envId, string key);

    Task<bool> HasKeyBeenUsedAsync(Guid envId, string key);

    Task DeleteAsync(Guid id);

    Task<ICollection<string>> GetAllTagsAsync(Guid envId);
}