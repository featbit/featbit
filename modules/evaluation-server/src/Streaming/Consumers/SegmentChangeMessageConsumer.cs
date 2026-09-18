using System.Text.Json;
using Domain.Messages;
using Domain.Observability;
using Microsoft.Extensions.Logging;
using Streaming.Connections;
using Streaming.Protocol;
using Streaming.Services;

namespace Streaming.Consumers;

public partial class SegmentChangeMessageConsumer(
    IConnectionManager connectionManager,
    IDataSyncService dataSyncService,
    ILogger<SegmentChangeMessageConsumer> logger)
    : IMessageConsumer
{
    public string Topic => Topics.SegmentChange;

    public async Task HandleAsync(string message, CancellationToken cancellationToken)
    {
        using var document = JsonDocument.Parse(message);
        var root = document.RootElement;
        if (!root.TryGetProperty("segment", out var segment) ||
            !root.TryGetProperty("affectedFlagIds", out var affectedFlagIds))
        {
            throw new InvalidDataException("invalid segment change data");
        }

        var envId = segment.GetProperty("envId").GetGuid();
        var flagIds = affectedFlagIds.Deserialize<string[]>()!;

        // Same identifier the API derived when it published this change, recomputed from the
        // message rather than carried on it (docs/observability/index.md §7).
        var changeId = ChangeId.FromJson(segment, ChangeId.SegmentResource);
        if (changeId is not null)
        {
            ActivityCorrelation.SetChangeId(changeId);
        }

        var connections = connectionManager.GetEnvConnections(envId);

        using var fanout = PropagationMetrics.Current.RecordFanout(ChangeId.SegmentResource);
        var failed = 0;
        var attempted = 0;

        foreach (var connection in connections)
        {
            try
            {
                if (connection.Type == ConnectionType.Client && flagIds.Length == 0)
                {
                    // Deliberately not counted as a delivery: nothing was owed to this connection,
                    // so counting it would dilute the delivery failure rate with skipped work.
                    continue;
                }

                attempted++;

                var payload = await dataSyncService.GetSegmentChangePayloadAsync(connection, segment, flagIds);
                var serverMessage = new ServerMessage(MessageTypes.DataSync, payload);

                await connection.SendAsync(serverMessage, cancellationToken);
                PropagationMetrics.Current.RecordDelivery(ChangeId.SegmentResource, Outcomes.Success);
            }
            catch (Exception ex)
            {
                failed++;
                PropagationMetrics.Current.RecordDelivery(ChangeId.SegmentResource, Outcomes.Failure);
                Log.ProcessingFailed(logger, connection.Id, envId, ex);
            }
        }

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