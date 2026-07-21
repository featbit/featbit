using System.Text.Json;
using Application;
using Application.FeatureFlags;
using Application.Segments;
using Domain.Messages;
using Domain.Utils;
using Microsoft.Extensions.Configuration;

namespace Infrastructure.MQ;

public class ControlPlaneWebHooksMessageHandler(IWebhookHandler webhookHandler, IConfiguration configuration) : IMessageHandler
{
    public string Topic => ControlPlaneTopics.ControlPlaneWebHooks;

    public async Task HandleAsync(string message)
    {
        using var document = JsonDocument.Parse(message);
        var root = document.RootElement;
        if (!root.TryGetProperty("type", out var type) || !root.TryGetProperty("region", out var region))
        {
            throw new InvalidDataException("invalid web hook message");
        }
        
        var controlPlaneWebHookType = type.Deserialize<ControlPlaneWebHookType>(ReusableJsonSerializerOptions.Web);
        var deserializedRegionNode = region.Deserialize<string>(ReusableJsonSerializerOptions.Web);
        if (deserializedRegionNode != configuration.GetRegion())
        {
            return;
        }

        switch (controlPlaneWebHookType)
        {
            case ControlPlaneWebHookType.Segment:
                await HandleSegments(root);
                break;
            case ControlPlaneWebHookType.FeatureFlag:
                await HandleFlag(root);
                break;
            default:
                throw new InvalidDataException("unsupported web hook type");
        }
    }

    private async Task HandleSegments(JsonElement root)
    {
        if (!root.TryGetProperty("notification", out var notification) ||
            !root.TryGetProperty("envIds", out var envIds))
        {
            throw new InvalidDataException("invalid segment web hook");
        }
        
        var deserializedNotificationNode = notification.Deserialize<OnSegmentChange>(ReusableJsonSerializerOptions.Web);
        var envIdsNode = envIds.Deserialize<List<Guid>>(ReusableJsonSerializerOptions.Web);

        if (deserializedNotificationNode is not null && envIdsNode is not null)
        {
            foreach (var envId in envIdsNode)
            {
                // handle webhook asynchronously
                _ = webhookHandler.HandleAsync(
                    envId,
                    deserializedNotificationNode.Segment,
                    deserializedNotificationNode.DataChange,
                    deserializedNotificationNode.OperatorId
                );
            }
        }
    }

    private async Task HandleFlag(JsonElement root)
    {
        if (!root.TryGetProperty("notification", out var notification))
        {
            throw new InvalidDataException("invalid flag change data");
        }
        var deserializedFlagNotification = notification.Deserialize<OnFeatureFlagChanged>(ReusableJsonSerializerOptions.Web);
        if (deserializedFlagNotification is not null)
        {
            _ = webhookHandler.HandleAsync(deserializedFlagNotification.Flag, deserializedFlagNotification.DataChange, deserializedFlagNotification.OperatorId);
        }
    }
}