using System.Text.Json;
using Confluent.Kafka;
using Domain.Core;
using Domain.Protocol;
using Domain.Services;
using Domain.WebSockets;
using Infrastructure.Redis;

namespace Infrastructure.Kafka;

public class FeatureFlagChangeMessageHandler : IKafkaMessageHandler
{
    public string Topic => Topics.FeatureFlagChange;

    private readonly RedisService _redisService;
    private readonly IConnectionManager _connectionManager;
    private readonly IDataSyncService _dataSyncService;

    public FeatureFlagChangeMessageHandler(
        RedisService redisService,
        IConnectionManager connectionManager,
        IDataSyncService dataSyncService)
    {
        _redisService = redisService;
        _connectionManager = connectionManager;
        _dataSyncService = dataSyncService;
    }

    public async Task HandleAsync(ConsumeResult<Null, string> consumeResult, CancellationToken cancellationToken)
    {
        var message = consumeResult.Message.Value;

        // upsert redis
        using var document = JsonDocument.Parse(message);
        var flag = document.RootElement;
        await _redisService.UpsertFlagAsync(flag);

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