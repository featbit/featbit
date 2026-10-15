using Application.FeatureFlags;
using Application.Segments;
using Application.Services;

namespace Application.ControlPlane;

// Business writes stage through this boundary; coordinator persistence still uses IService.
public interface IGatedFeatureFlagStore
{
    bool GatedCommitEnabled { get; }
    Task StageChangeAsync(OnFeatureFlagChanged change, bool isNew);
}

public interface IGatedSegmentStore
{
    bool GatedCommitEnabled { get; }
    Task StageChangeAsync(OnSegmentChange change, bool isNew);
}

public static class CommittedMutationStore
{
    public static Task SaveChangeAsync(this IFeatureFlagService service, OnFeatureFlagChanged change, bool isNew = false) =>
        service is IGatedFeatureFlagStore { GatedCommitEnabled: true } gated
            ? gated.StageChangeAsync(change, isNew)
            : isNew ? service.AddOneAsync(change.Flag) : service.UpdateAsync(change.Flag);

    public static Task SaveChangeAsync(this ISegmentService service, OnSegmentChange change, bool isNew = false) =>
        service is IGatedSegmentStore { GatedCommitEnabled: true } gated
            ? gated.StageChangeAsync(change, isNew)
            : isNew ? service.AddOneAsync(change.Segment) : service.UpdateAsync(change.Segment);
}
