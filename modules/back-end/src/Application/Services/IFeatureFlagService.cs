using Application.Bases.Models;
using Application.FeatureFlags;
using Domain.FeatureFlags;

namespace Application.Services;

public interface IFeatureFlagService
{
    Task<PagedResult<FeatureFlag>> GetListAsync(Guid envId, FeatureFlagFilter filter);
}