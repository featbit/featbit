namespace Application.Segments.MessagePublishing.SegmentChange;

public class DirectSegmentChangePublisher(
    ISegmentMessageService segmentMessageService,
    IFeatureFlagAppService featureFlagAppService,
    ISegmentService segmentService) : ISegmentChangePublisher
{
    public async Task PublishAsync(OnSegmentChange notification)
    {
        var segment = notification.Segment;
        var envIds = await segmentService.GetEnvironmentIdsAsync(segment);

        foreach (var envId in envIds)
        {
            var affectedFlags = await segmentMessageService.GetAffectedFlagsAsync(envId, notification);

            // update affected flags
            if (affectedFlags.Count > 0)
            {
                await featureFlagAppService.OnSegmentUpdatedAsync(segment, notification.OperatorId, affectedFlags);
            }

            // publish segment change message
            await segmentMessageService.PublishSegmentChangeMessage(envId, affectedFlags, segment);
        }
    }
}