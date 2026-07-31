using System.Text.Json;
using System.Text.Json.Nodes;
using Domain.AuditLogs;
using Domain.Messages;
using Domain.Segments;

namespace Application.Segments;

public class SegmentMessageService(ISegmentService segmentService, IMessageProducer messageProducer)
    : ISegmentMessageService
{
    public async ValueTask<ICollection<FlagReference>> GetAffectedFlagsAsync(Guid envId, OnSegmentChange notification)
    {
        // no affected flags for create/archive/restore operations
        if (notification.Operation is Operations.Archive or Operations.Restore or Operations.Create)
        {
            return [];
        }

        // only targeting change affects flags
        if (!notification.IsTargetingChange)
        {
            return [];
        }

        var affectedFlags = await segmentService.GetFlagReferencesAsync(envId, notification.Segment.Id);
        return affectedFlags;
    }

    public async Task PublishChangeMessage(Guid envId, ICollection<FlagReference> affectedFlags, Segment segment)
    {
        JsonObject message = new()
        {
            ["segment"] = segment.SerializeAsEnvironmentSpecific(envId),
            ["affectedFlagIds"] = JsonSerializer.SerializeToNode(affectedFlags.Select(x => x.Id))
        };

        await messageProducer.PublishAsync(Topics.SegmentChange, message);
    }
}