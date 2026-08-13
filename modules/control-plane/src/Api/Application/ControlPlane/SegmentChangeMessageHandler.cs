using System.Text.Json;
using Application;
using Application.Caches;
using Application.ControlPlane;
using Application.Segments;
using Application.Services;
using Domain.Messages;
using Domain.Segments;
using Domain.Utils;

namespace Api.Application.ControlPlane;

public class SegmentChangeMessageHandler(
    [FromKeyedServices("compositeCache")] ICacheService cacheService,
    IFeatureFlagAppService featureFlagAppService,
    ISegmentMessageService segmentMessageService,
    ISegmentService segmentService,
    ILogger<SegmentChangeMessageHandler> logger,
    IConfiguration configuration,
    IMessageProducer messageProducer) : IMessageHandler
{
    public string Topic => ControlPlaneTopics.ControlPlaneSegmentChange;

    public async Task HandleAsync(string message)
    {
        try
        {
            using var document = JsonDocument.Parse(message);
            var root = document.RootElement;
            if (!root.TryGetProperty("segmentNonSpecific", out var segmentNonSpecific) ||
                !root.TryGetProperty("envIds", out var envIds) ||
                !root.TryGetProperty("notification", out var notification) ||
                !root.TryGetProperty("region", out var region))
            {
                throw new InvalidDataException("invalid segment change data");
            }

            var deserializedSegmentNonEnvironmentSpecificNode =
                segmentNonSpecific.Deserialize<Segment>(ReusableJsonSerializerOptions.Web);
            var deserializedEnvIdsNode = envIds.Deserialize<ICollection<Guid>>(ReusableJsonSerializerOptions.Web);
            var deserializedNotificationNode =
                notification.Deserialize<OnSegmentChange>(ReusableJsonSerializerOptions.Web);
            var deserializedRegionNode = region.Deserialize<string>(ReusableJsonSerializerOptions.Web);

            if (deserializedSegmentNonEnvironmentSpecificNode is not null && deserializedEnvIdsNode is not null &&
                deserializedNotificationNode is not null && deserializedRegionNode is not null &&
                deserializedRegionNode == configuration.GetRegion())
            {
                if (configuration.GetConsistencyMode() == ConsistencyMode.GatedCommit)
                {
                    // GatedCommit (S2): stage the new segment value to every DC's Redis and record
                    // the Mongo pending change, but do NOT publish the affected-flags / segment
                    // change to the evaluation-server topics yet. The commit/publish is the
                    // coordinator's responsibility (S3).
                    var ts = new DateTimeOffset(deserializedSegmentNonEnvironmentSpecificNode.UpdatedAt)
                        .ToUnixTimeMilliseconds();
                    await cacheService.StageSegmentAsync(deserializedSegmentNonEnvironmentSpecificNode, ts);
                    await segmentService.SetPendingAsync(
                        deserializedSegmentNonEnvironmentSpecificNode.Id,
                        deserializedSegmentNonEnvironmentSpecificNode,
                        ts,
                        deserializedNotificationNode.OperatorId,
                        deserializedNotificationNode.Operation,
                        deserializedNotificationNode.IsTargetingChange);
                }
                else
                {
                    // BestEffort: unchanged upsert + affected-flags propagation.
                    await cacheService
                        .UpsertSegmentAsync(deserializedEnvIdsNode, deserializedSegmentNonEnvironmentSpecificNode);

                    foreach (var envId in deserializedEnvIdsNode)
                    {
                        var affectedFlags =
                            await segmentMessageService.GetAffectedFlagsAsync(envId, deserializedNotificationNode);

                        // update affected flags
                        if (affectedFlags.Count > 0)
                        {
                            await featureFlagAppService.OnSegmentUpdatedAsync(
                                deserializedSegmentNonEnvironmentSpecificNode,
                                deserializedNotificationNode.OperatorId, affectedFlags);
                        }

                        // publish segment change message
                        await segmentMessageService.PublishChangeMessage(envId, affectedFlags,
                            deserializedSegmentNonEnvironmentSpecificNode);
                    }
                }

                var webHooksMessage = new
                {
                    notification = deserializedNotificationNode, envIds = deserializedEnvIdsNode,
                    region = deserializedRegionNode, type = ControlPlaneWebHookType.Segment
                };
                await messageProducer.PublishAsync(ControlPlaneTopics.ControlPlaneWebHooks, webHooksMessage);
            }
        }
        catch (Exception e)
        {
            logger.LogError(e, "Error processing segment change message");
            throw;
        }
    }
}