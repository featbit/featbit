using System.ComponentModel;
using Domain.FeatureFlags;
using Domain.Segments;

namespace Application.Caches;

public interface ICacheService
{
    Task UpsertFlagAsync(FeatureFlag flag);

    Task DeleteFlagAsync(Guid envId, Guid flagId);

    Task UpsertSegmentAsync(Segment segment);

    Task UpsertLicenseAsync(Guid orgId, string license);
    
    Task<string?> GetLicenseAsync(Guid orgId);
}