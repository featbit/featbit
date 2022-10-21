using Domain.FeatureFlags;
using Domain.Segments;

namespace Application.Services;

public interface IRedisService
{
    Task UpsertFlagAsync(FeatureFlag flag);

    Task DeleteFlagAsync(Guid envId, Guid flagId);

    Task UpsertSegmentAsync(Segment segment);

    Task DeleteSegmentAsync(Guid envId, Guid segmentId);
}