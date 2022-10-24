using System.Text.Json;
using System.Text.Json.Nodes;
using Domain.Core;
using Domain.EndUsers;
using Domain.Protocol;
using Domain.Services;
using Domain.WebSockets;
using Infrastructure.Caches;

namespace Infrastructure.Services;

public class DataSyncService : IDataSyncService
{
    private readonly RedisService _redisService;
    private readonly EvaluationService _evaluationService;

    public DataSyncService(RedisService redisService, EvaluationService evaluationService)
    {
        _redisService = redisService;
        _evaluationService = evaluationService;
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

        object payload = connection.Type switch
        {
            ConnectionType.Client => await GetClientSdkPayloadAsync(connection.EnvId, connection.User!, timestamp),
            ConnectionType.Server => await GetServerSdkPayloadAsync(connection.EnvId, timestamp),
            _ => throw new ArgumentOutOfRangeException(nameof(connection), $"unsupported sdk type {connection.Type}")
        };

        return new ServerMessage(MessageTypes.DataSync, payload);
    }

    #region get client sdk payload

    private async Task<ClientSdkPayload> GetClientSdkPayloadAsync(Guid envId, EndUser user, long timestamp)
    {
        var eventType = timestamp == 0 ? DataSyncEventTypes.Full : DataSyncEventTypes.Patch;
        var flagsBytes = await _redisService.GetFlagsAsync(envId, timestamp);

        var clientSdkFlags = new List<ClientSdkFeatureFlag>();
        foreach (var flagBytes in flagsBytes)
        {
            using var document = JsonDocument.Parse(flagBytes);

            var flag = document.RootElement;
            var variations =
                flag.GetProperty("variations").Deserialize<Variation[]>(ReusableJsonSerializerOptions.Web)!;

            var scope = new EvaluationScope(flag, user, variations);
            var userVariation = await _evaluationService.EvaluateAsync(scope);

            clientSdkFlags.Add(new ClientSdkFeatureFlag(flag, userVariation, variations));
        }

        return new ClientSdkPayload(eventType, user.KeyId, clientSdkFlags);
    }

    #endregion

    #region get server sdk payload

    private async Task<ServerSdkPayload> GetServerSdkPayloadAsync(Guid envId, long timestamp)
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

        return new ServerSdkPayload(eventType, featureFlags, segments);
    }

    #endregion
}