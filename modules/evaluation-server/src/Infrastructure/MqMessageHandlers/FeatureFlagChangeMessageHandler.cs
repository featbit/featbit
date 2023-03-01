using System.Text.Json;
using Domain.Core;
using Domain.Protocol;
using Domain.Services;
using Domain.WebSockets;
using Infrastructure.Caches;

namespace Infrastructure.MqMessageHandlers;

public class FeatureFlagChangeMessageHandler : IMqMessageHandler
{
    public string Topic => Topics.FeatureFlagChange;

    private readonly ICacheService _cacheService;
    private readonly IConnectionManager _connectionManager;
    private readonly IDataSyncService _dataSyncService;

    public FeatureFlagChangeMessageHandler(
        ICacheService cacheService,
        IConnectionManager connectionManager,
        IDataSyncService dataSyncService)
    {
        _cacheService = cacheService;
        _connectionManager = connectionManager;
        _dataSyncService = dataSyncService;
    }

    public async Task HandleAsync(string message, CancellationToken cancellationToken)
    {
        // upsert redis
        using var document = JsonDocument.Parse(message);
        var flag = document.RootElement;
        await _cacheService.UpsertFlagAsync(flag);

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