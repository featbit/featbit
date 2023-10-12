using Domain.Segments;
using Domain.FeatureFlags;
using Domain.Organizations;

namespace Application.Caches;

public interface ICacheService
{
    Task UpsertFlagAsync(FeatureFlag flag);

    Task DeleteFlagAsync(Guid envId, Guid flagId);

    Task UpsertSegmentAsync(Segment segment);

    Task UpsertLicenseAsync(Organization organization);

    Task<string> GetLicenseAsync(Guid orgId);
}