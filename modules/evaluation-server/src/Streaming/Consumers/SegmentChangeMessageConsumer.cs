using System.Text.Json;
using Domain.Messages;
using Streaming.Connections;
using Streaming.Protocol;
using Streaming.Services;

namespace Streaming.Consumers;

public class SegmentChangeMessageConsumer : IMessageConsumer
{
    public string Topic => Topics.SegmentChange;

    private readonly IConnectionManager _connectionManager;
    private readonly IDataSyncService _dataSyncService;

    public SegmentChangeMessageConsumer(IConnectionManager connectionManager, IDataSyncService dataSyncService)
    {
        _connectionManager = connectionManager;
        _dataSyncService = dataSyncService;
    }

    public async Task HandleAsync(string message, CancellationToken cancellationToken)
    {
        using var document = JsonDocument.Parse(message);
        var root = document.RootElement;
        if (!root.TryGetProperty("segment", out var segment) ||
            !root.TryGetProperty("affectedFlagIds", out var affectedFlagIds))
        {
            throw new InvalidDataException("invalid segment change data");
        }

        // push change message to sdk
        var envId = segment.GetProperty("envId").GetGuid();
        var flagIds = affectedFlagIds.Deserialize<string[]>()!;
        var connections = _connectionManager.GetEnvConnections(envId);
        foreach (var connection in connections)
        {
            if (connection.Type == ConnectionType.Client && flagIds.Length == 0)
            {
                continue;
            }

            var payload = await _dataSyncService.GetSegmentChangePayloadAsync(connection, segment, flagIds);
            var serverMessage = new ServerMessage(MessageTypes.DataSync, payload);

            await connection.SendAsync(serverMessage, cancellationToken);
        }
    }
}