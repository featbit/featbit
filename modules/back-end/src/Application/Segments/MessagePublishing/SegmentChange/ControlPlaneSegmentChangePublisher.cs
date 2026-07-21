using System.Text.Json;
using System.Text.Json.Nodes;
using Domain.Messages;
using Domain.Utils;
using Microsoft.Extensions.Configuration;

namespace Application.Segments.MessagePublishing.SegmentChange;

public class ControlPlaneSegmentChangePublisher(IMessageProducer messageProducer, ISegmentService segmentService, IConfiguration configuration) : ISegmentChangePublisher
{
    public async Task PublishAsync(OnSegmentChange notification)
    {
        var segment = notification.Segment;
        var envIds = await segmentService.GetEnvironmentIdsAsync(segment);
        
        var segmentNonEnvironmentSpecificNode = JsonSerializer.SerializeToNode(segment, ReusableJsonSerializerOptions.Web);
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
}