using Application.Bases.Models;
using Application.FeatureFlags;
using Domain.FeatureFlags;
using Domain.Segments;

namespace Application.Services;

public interface IFeatureFlagService : IService<FeatureFlag>
{
    Task<PagedResult<FeatureFlag>> GetListAsync(Guid envId, FeatureFlagFilter filter);

    Task<FeatureFlag> GetAsync(Guid envId, string key);

    Task<bool> HasKeyBeenUsedAsync(Guid envId, string key);

    Task<ICollection<string>> GetAllTagsAsync(Guid envId);

    Task<ICollection<Segment>> GetRelatedSegmentsAsync(ICollection<FeatureFlag> flags);

    Task MarkAsUpdatedAsync(ICollection<Guid> flagIds, Guid operatorId);
}