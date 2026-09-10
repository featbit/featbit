using System.Text.Json;
using Application;
using Application.Caches;
using Application.ControlPlane;
using Application.FeatureFlags;
using Application.Services;
using Domain.Messages;
using Domain.Observability;
using Domain.Utils;

namespace Api.Application.ControlPlane;

public class FeatureFlagChangeMessageHandler(
    [FromKeyedServices("compositeCache")] ICacheService cacheService,
    IMessageProducer messageProducer,
    IFeatureFlagService featureFlagService,
    ILogger<FeatureFlagChangeMessageHandler> logger,
    IConfiguration configuration) : IMessageHandler
{
    public string Topic => ControlPlaneTopics.ControlPlaneFeatureFlagChange;

    public async Task HandleAsync(string message)
    {
        try
        {
            using var document = JsonDocument.Parse(message);
            var root = document.RootElement;


            if (!root.TryGetProperty("notification", out var notification) ||
                !root.TryGetProperty("region", out var region))
            {
                throw new InvalidDataException("invalid flag change data");
            }

            var deserializedRegion = region.Deserialize<string>(ReusableJsonSerializerOptions.Web);
            if (deserializedRegion != null && deserializedRegion == configuration.GetRegion())
            {
                var deserializedFlagNotification =
                    notification.Deserialize<OnFeatureFlagChanged>(ReusableJsonSerializerOptions.Web);
                if (deserializedFlagNotification != null)
                {
                    var flag = deserializedFlagNotification.Flag;

                    // Same identifier the API derived when it published this change, recomputed from
                    // the deserialized flag so this hop joins the same logical change
                    // (docs/observability/index.md §7).
                    ActivityCorrelation.SetChangeId(
                        ChangeId.For(ChangeId.FlagResource, flag.EnvId, flag.Key, flag.UpdatedAt));

                    // The relay stage: replicate to every DC's Redis and republish. Timed here
                    // rather than around the whole handler so a slow fan-out is not conflated with
                    // JSON parsing or the webhook publish below.
                    using var relay = PropagationMetrics.Current.BeginStage(
                        ChangeId.FlagResource, PropagationStages.Relay);

                    if (configuration.GetConsistencyMode() == ConsistencyMode.GatedCommit)
                    {
                        // GatedCommit (C2): stage the new value to every DC's Redis and record the
                        // Mongo pending change, but do NOT publish to the evaluation-server topic yet.
                        // The commit/publish is C3's responsibility.
                        var ts = new DateTimeOffset(flag.UpdatedAt).ToUnixTimeMilliseconds();
                        await cacheService.StageFlagAsync(flag, ts);
                        await featureFlagService.SetPendingAsync(flag.EnvId, flag.Key, flag, ts);
                    }
                    else
                    {
                        // BestEffort: unchanged fire-and-forget propagation.
                        await cacheService.UpsertFlagAsync(flag);
                        await messageProducer.PublishAsync(Topics.FeatureFlagChange, flag);
                    }

                    relay.Succeeded();
                }

                var webHooksMessage = new
                {
                    notification = deserializedFlagNotification, region = deserializedRegion,
                    type = ControlPlaneWebHookType.FeatureFlag
                };
                await messageProducer.PublishAsync(ControlPlaneTopics.ControlPlaneWebHooks, webHooksMessage);
            }
        }
        catch (Exception e)
        {
            logger.LogError(e, "Error handling feature flag change message");
            throw;
        }
    }
}