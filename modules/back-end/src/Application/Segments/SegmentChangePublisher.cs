using System.Text.Json;
using System.Text.Json.Nodes;
using Domain.Messages;
using Domain.Utils;
using Microsoft.Extensions.Configuration;

namespace Application.Segments;

public interface ISegmentChangePublisher
{
    Task PublishAsync(OnSegmentChange notification);

    /// <summary>
    /// Tells every datacenter that the segment was deleted, so each removes it from its own Redis.
    /// </summary>
    Task PublishDeletedAsync(ICollection<Guid> envIds, Guid segmentId);
}

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
            // update affected flags
            var affectedFlags = await segmentMessageService.GetAffectedFlagsAsync(envId, notification);
            if (affectedFlags.Count > 0)
            {
                await featureFlagAppService.OnSegmentUpdatedAsync(
                    notification.WorkspaceId,
                    notification.OrganizationId,
                    segment, notification.OperatorId, affectedFlags);
            }

            // publish segment change message
            await segmentMessageService.PublishChangeMessage(envId, affectedFlags, segment);
        }
    }

    // Without the control plane there is a single Redis, which the delete handler has already updated.
    public Task PublishDeletedAsync(ICollection<Guid> envIds, Guid segmentId) => Task.CompletedTask;
}

public class ControlPlaneSegmentChangePublisher(
    IMessageProducer messageProducer,
    ISegmentService segmentService,
    IConfiguration configuration) : ISegmentChangePublisher
{
    public async Task PublishAsync(OnSegmentChange notification)
    {
        var segment = notification.Segment;
        var envIds = await segmentService.GetEnvironmentIdsAsync(segment);

        var segmentNonEnvironmentSpecificNode =
            JsonSerializer.SerializeToNode(segment, ReusableJsonSerializerOptions.Web);
        var envIdsNode = JsonSerializer.SerializeToNode(envIds, ReusableJsonSerializerOptions.Web);
        var notificationNode = JsonSerializer.SerializeToNode(notification, ReusableJsonSerializerOptions.Web);
        var regionNode = configuration.GetRegion();

        JsonObject segmentUpsertMessage = new()
        {
            ["segmentNonSpecific"] = segmentNonEnvironmentSpecificNode,
            ["envIds"] = envIdsNode,
            ["notification"] = notificationNode,
            ["region"] = regionNode
        };

        await messageProducer.PublishAsync(ControlPlaneTopics.ControlPlaneSegmentChange, segmentUpsertMessage);
    }

    // Sent on the same topic as the change. The "deleted" shape has no "notification", so a control plane that
    // does not know it rejects the message instead of treating it as a change.
    public async Task PublishDeletedAsync(ICollection<Guid> envIds, Guid segmentId)
    {
        var message = new
        {
            deleted = new { envIds, id = segmentId },
            region = configuration.GetRegion()
        };

        await messageProducer.PublishAsync(ControlPlaneTopics.ControlPlaneSegmentChange, message);
    }
}
