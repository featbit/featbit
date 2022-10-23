using System.Text.Json.Nodes;
using Domain.Protocol;
using Domain.Services;
using Domain.WebSockets;
using Infrastructure.Caches;

namespace Infrastructure.Services;

public class DataSyncService : IDataSyncService
{
    private readonly RedisService _redisService;

    public DataSyncService(RedisService redisService)
    {
        _redisService = redisService;
    }

    public async Task<ServerMessage> GetResponseAsync(Connection connection, DataSyncMessage message)
    {
        // attach client-side sdk EndUser
        if (connection.Type == ConnectionType.Client)
        {
            connection.AttachUser(message.User!);
        }

        // if timestamp is null or not specified, treat as 0 (default value)
        var timestamp = message.Timestamp.GetValueOrDefault();

        var response = connection.Type switch
        {
            ConnectionType.Server => await GetServerSdkPayloadAsync(connection.EnvId, timestamp),
            _ => throw new ArgumentOutOfRangeException(nameof(connection), $"unsupported sdk type {connection.Type}")
        };

        return response;
    }

    #region get server sdk payload

    private async Task<ServerMessage> GetServerSdkPayloadAsync(Guid envId, long timestamp)
    {
        var eventType = timestamp == 0 ? DataSyncEventTypes.Full : DataSyncEventTypes.Patch;
        var featureFlags = new List<JsonObject>();
        var segments = new List<JsonObject>();

        var flagsBytes = await _redisService.GetFlagsAsync(envId, timestamp);
        foreach (var flag in flagsBytes)
        {
            var jsonObject = JsonNode.Parse(flag)!.AsObject();
            featureFlags.Add(jsonObject);
        }

        var segmentsBytes = await _redisService.GetSegmentsAsync(envId, timestamp);
        foreach (var segment in segmentsBytes)
        {
            var jsonObject = JsonNode.Parse(segment)!.AsObject();
            segments.Add(jsonObject);
        }

        return new ServerMessage(MessageTypes.DataSync, new
        {
            eventType,
            featureFlags,
            segments
        });
    }

    #endregion
}