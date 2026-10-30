using System.Text.Json;
using Domain.Messages;
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

        var connections = connectionManager.GetEnvConnections(envId);
        foreach (var connection in connections)
        {
            try
            {
                var payload = await dataSyncService.GetFlagChangePayloadAsync(connection, flag);
                var serverMessage = new ServerMessage(MessageTypes.DataSync, payload);

                connection.QueueSend(serverMessage, cancellationToken, error => logger.LogError(
                    error,
                    "Failed to send feature flag change to connection {ConnectionId} in env {EnvId}; reconnect required.",
                    connection.Id, envId));
            }
            catch (Exception ex)
            {
                logger.LogError(
                    ex,
                    "Exception occurred while processing feature flag change message for connection {ConnectionId} in env {EnvId}.",
                    connection.Id,
                    envId
                );
            }
        }
    }
}
