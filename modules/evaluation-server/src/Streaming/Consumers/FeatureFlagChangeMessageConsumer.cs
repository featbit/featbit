using System.Text.Json;
using Domain.Messages;
using Domain.Observability;
using Microsoft.Extensions.Logging;
using Streaming.Connections;
using Streaming.Protocol;
using Streaming.Services;

namespace Streaming.Consumers;

public class FeatureFlagChangeMessageConsumer(
    IConnectionManager connectionManager,
    IDataSyncService dataSyncService,
    ILogger<FeatureFlagChangeMessageConsumer> logger)
    : IMessageConsumer
{
    public string Topic => Topics.FeatureFlagChange;

    public async Task HandleAsync(string message, CancellationToken cancellationToken)
    {
        using var document = JsonDocument.Parse(message);
        var flag = document.RootElement;

        var envId = flag.GetProperty("envId").GetGuid();

        // Same identifier the API derived when it published this change, recomputed from the
        // message rather than carried on it, so this fan-out can be tied back to the originating
        // request (docs/observability/index.md §7).
        var changeId = ChangeId.FromJson(flag, ChangeId.FlagResource);
        if (changeId is not null)
        {
            ActivityCorrelation.SetChangeId(changeId);
        }

        var connections = connectionManager.GetEnvConnections(envId);

        // Timed once for the whole fan-out, with each connection counted separately: a per-connection
        // histogram would measure fan-out width rather than latency.
        using var fanout = PropagationMetrics.Current.RecordFanout(ChangeId.FlagResource);
        var failed = 0;
        var attempted = 0;

        foreach (var connection in connections)
        {
            attempted++;

            try
            {
                var payload = await dataSyncService.GetFlagChangePayloadAsync(connection, flag);
                var serverMessage = new ServerMessage(MessageTypes.DataSync, payload);

                await connection.SendAsync(serverMessage, cancellationToken);
                PropagationMetrics.Current.RecordDelivery(ChangeId.FlagResource, Outcomes.Success);
            }
            catch (Exception ex)
            {
                failed++;
                PropagationMetrics.Current.RecordDelivery(ChangeId.FlagResource, Outcomes.Failure);
                logger.LogError(
                    ex,
                    "Exception occurred while processing feature flag change message for connection {ConnectionId} in env {EnvId}.",
                    connection.Id,
                    envId
                );
            }
        }

        // A fan-out that reached some but not all connections is neither a success nor an outage,
        // and collapsing it into either hides the only case worth investigating.
        if (failed == 0)
        {
            fanout.Succeeded();
        }
        else if (failed < attempted)
        {
            fanout.Partial();
        }

        fanout.SetFanoutCounts(attempted, failed);
    }
}
