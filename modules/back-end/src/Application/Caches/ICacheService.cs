using Domain.Segments;
using Domain.FeatureFlags;
using Domain.Organizations;
using Domain.Workspaces;

namespace Application.Caches;

public interface ICacheService
{
    Task UpsertFlagAsync(FeatureFlag flag);

    Task DeleteFlagAsync(Guid envId, Guid flagId);

    Task UpsertSegmentAsync(Segment segment);

    Task DeleteSegmentAsync(Guid envId, Guid segmentId);

    Task UpsertLicenseAsync(Workspace workspace);

    Task<string> GetLicenseAsync(Guid workspaceId);
}