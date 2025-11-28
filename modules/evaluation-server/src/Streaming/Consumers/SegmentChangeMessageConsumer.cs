using System.Text.Json;
using Domain.Messages;
using Microsoft.Extensions.Logging;
using Streaming.Connections;
using Streaming.Protocol;
using Streaming.Services;

namespace Streaming.Consumers;

public class SegmentChangeMessageConsumer(
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

        var connections = connectionManager.GetEnvConnections(envId);
        foreach (var connection in connections)
        {
            try
            {
                if (connection.Type == ConnectionType.Client && flagIds.Length == 0)
                {
                    continue;
                }

                var payload = await dataSyncService.GetSegmentChangePayloadAsync(connection, segment, flagIds);
                var serverMessage = new ServerMessage(MessageTypes.DataSync, payload);

                await connection.SendAsync(serverMessage, cancellationToken);
            }
            catch (Exception ex)
            {
                logger.LogError(
                    ex,
                    "Exception occurred while processing segment change message for connection {ConnectionId} in env {EnvId}.",
                    connection.Id,
                    envId
                );
            }
        }
    }
}