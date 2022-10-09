using Application.Bases.Models;
using Application.FeatureFlags;
using Domain.FeatureFlags;

namespace Application.Services;

public interface IFeatureFlagService
{
    Task<PagedResult<FeatureFlag>> GetListAsync(Guid envId, FeatureFlagFilter filter);

    Task<FeatureFlag> GetAsync(Guid id);

    Task<FeatureFlag> GetAsync(Guid envId, string key);

    Task AddAsync(FeatureFlag flag);

    Task UpdateAsync(FeatureFlag flag);
}