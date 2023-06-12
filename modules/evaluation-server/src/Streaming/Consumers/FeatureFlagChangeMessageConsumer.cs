using System.Text.Json;
using Domain.Messages;
using Streaming.Connections;
using Streaming.Protocol;
using Streaming.Services;

namespace Streaming.Consumers;

public class FeatureFlagChangeMessageConsumer : IMessageConsumer
{
    public string Topic => Topics.FeatureFlagChange;

    private readonly IConnectionManager _connectionManager;
    private readonly IDataSyncService _dataSyncService;

    public FeatureFlagChangeMessageConsumer(IConnectionManager connectionManager, IDataSyncService dataSyncService)
    {
        _connectionManager = connectionManager;
        _dataSyncService = dataSyncService;
    }

    public async Task HandleAsync(string message, CancellationToken cancellationToken)
    {
        using var document = JsonDocument.Parse(message);
        var flag = document.RootElement;

        // push change message to sdk
        var envId = flag.GetProperty("envId").GetGuid();
        var connections = _connectionManager.GetEnvConnections(envId);
        foreach (var connection in connections)
        {
            var payload = await _dataSyncService.GetFlagChangePayloadAsync(connection, flag);
            var serverMessage = new ServerMessage(MessageTypes.DataSync, payload);

            await connection.SendAsync(serverMessage, cancellationToken);
        }
    }
}