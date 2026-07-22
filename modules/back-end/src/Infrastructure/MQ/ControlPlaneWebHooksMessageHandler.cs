using System.Text.Json;
using Application;
using Application.FeatureFlags;
using Application.Segments;
using Domain.Messages;
using Domain.Utils;
using Microsoft.Extensions.Configuration;

namespace Infrastructure.MQ;

public class ControlPlaneWebHooksMessageHandler(IWebhookHandler webhookHandler, IConfiguration configuration)
    : IMessageHandler
{
    public string Topic => ControlPlaneTopics.ControlPlaneWebHooks;

    public Task HandleAsync(string message)
    {
        using var document = JsonDocument.Parse(message);
        var root = document.RootElement;
        if (!root.TryGetProperty("type", out var type) || !root.TryGetProperty("region", out var region))
        {
            throw new InvalidDataException("Invalid control plane webhook message");
        }

        var controlPlaneWebHookType = type.Deserialize<ControlPlaneWebHookType>(ReusableJsonSerializerOptions.Web);
        var deserializedRegionNode = region.Deserialize<string>(ReusableJsonSerializerOptions.Web);
        if (deserializedRegionNode != configuration.GetRegion())
        {
            return Task.CompletedTask;
        }

        switch (controlPlaneWebHookType)
        {
            case ControlPlaneWebHookType.Segment:
                HandleSegments(root);
                break;
            case ControlPlaneWebHookType.FeatureFlag:
                HandleFlag(root);
                break;
            default:
                throw new InvalidDataException("Unsupported control plane webhook type");
        }

        return Task.CompletedTask;
    }

    private void HandleSegments(JsonElement root)
    {
        if (!root.TryGetProperty("notification", out var notificationElem) ||
            !root.TryGetProperty("envIds", out var envIdsElem))
        {
            throw new InvalidDataException("Invalid segment change data");
        }

        var notification = notificationElem.Deserialize<OnSegmentChange>(ReusableJsonSerializerOptions.Web);
        var envIds = envIdsElem.Deserialize<List<Guid>>(ReusableJsonSerializerOptions.Web);

        if (notification is not null && envIds is not null)
        {
            foreach (var envId in envIds)
            {
                // handle webhook asynchronously
                _ = webhookHandler.HandleAsync(
                    envId,
                    notification.Segment,
                    notification.DataChange,
                    notification.OperatorId
                );
            }
        }
    }

    private void HandleFlag(JsonElement root)
    {
        if (!root.TryGetProperty("notification", out var notificationElem))
        {
            throw new InvalidDataException("Invalid flag change data");
        }

        var notification = notificationElem.Deserialize<OnFeatureFlagChanged>(ReusableJsonSerializerOptions.Web);
        if (notification is not null)
        {
            _ = webhookHandler.HandleAsync(notification.Flag, notification.DataChange, notification.OperatorId);
        }
    }
}