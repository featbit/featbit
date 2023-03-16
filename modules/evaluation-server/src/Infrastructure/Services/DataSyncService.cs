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
    private readonly ICacheService _cacheService;
    private readonly EvaluationService _evaluationService;

    public DataSyncService(ICacheService cacheService, EvaluationService evaluationService)
    {
        _cacheService = cacheService;
        _evaluationService = evaluationService;
    }

    public async Task<object> GetPayloadAsync(Connection connection, DataSyncMessage message)
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

        return payload;
    }

    public async Task<ClientSdkPayload> GetClientSdkPayloadAsync(Guid envId, EndUser user, long timestamp)
    {
        var eventType = timestamp == 0 ? DataSyncEventTypes.Full : DataSyncEventTypes.Patch;
        var flagsBytes = await _cacheService.GetFlagsAsync(envId, timestamp);

        var clientSdkFlags = new List<ClientSdkFlag>();
        foreach (var flagBytes in flagsBytes)
        {
            using var document = JsonDocument.Parse(flagBytes);
            var flag = document.RootElement;

            clientSdkFlags.Add(await GetClientSdkFlagAsync(flag, user));
        }

        return new ClientSdkPayload(eventType, user.KeyId, clientSdkFlags);
    }

    public async Task<ServerSdkPayload> GetServerSdkPayloadAsync(Guid envId, long timestamp)
    {
        var eventType = timestamp == 0 ? DataSyncEventTypes.Full : DataSyncEventTypes.Patch;
        var featureFlags = new List<JsonObject>();
        var segments = new List<JsonObject>();

        var flagsBytes = await _cacheService.GetFlagsAsync(envId, timestamp);
        foreach (var flag in flagsBytes)
        {
            var jsonObject = JsonNode.Parse(flag)!.AsObject();
            jsonObject.Remove("");
            featureFlags.Add(jsonObject);
        }

        var segmentsBytes = await _cacheService.GetSegmentsAsync(envId, timestamp);
        foreach (var segment in segmentsBytes)
        {
            var jsonObject = JsonNode.Parse(segment)!.AsObject();
            segments.Add(jsonObject);
        }

        return new ServerSdkPayload(eventType, featureFlags, segments);
    }

    public async Task<object> GetFlagChangePayloadAsync(Connection connection, JsonElement flag)
    {
        if (connection.Type == ConnectionType.Client && connection.User == null)
        {
            throw new ArgumentException($"client sdk must have user info when sync data. Connection: {connection}");
        }

        object payload = connection.Type switch
        {
            ConnectionType.Client => await GetClientSdkFlagChangePayloadAsync(flag, connection.User!),
            ConnectionType.Server => GetServerSdkFlagChangePayload(flag),
            _ => throw new ArgumentOutOfRangeException(
                nameof(connection), $"unsupported sdk type {connection.Type}"
            )
        };

        return payload;
    }

    public async Task<object> GetSegmentChangePayloadAsync(
        Connection connection,
        JsonElement segment,
        string[] affectedFlagIds)
    {
        if (connection.Type == ConnectionType.Client && connection.User == null)
        {
            throw new ArgumentException($"client sdk must have user info when sync data. Connection: {connection}");
        }

        object payload = connection.Type switch
        {
            ConnectionType.Client => await GetClientSegmentChangePayloadAsync(affectedFlagIds, connection.User!),
            ConnectionType.Server => GetServerSdkSegmentChangePayload(segment),
            _ => throw new ArgumentOutOfRangeException(
                nameof(connection), $"unsupported sdk type {connection.Type}"
            )
        };

        return payload;
    }

    #region get client sdk payload

    private async Task<ClientSdkPayload> GetClientSdkFlagChangePayloadAsync(JsonElement flag, EndUser user)
    {
        return new ClientSdkPayload(
            DataSyncEventTypes.Patch,
            user.KeyId,
            new[] { await GetClientSdkFlagAsync(flag, user) }
        );
    }

    private async Task<ClientSdkPayload> GetClientSegmentChangePayloadAsync(string[] affectedFlagIds, EndUser user)
    {
        var clientSdkFlags = new List<ClientSdkFlag>();

        var flags = await _cacheService.GetFlagsAsync(affectedFlagIds);
        foreach (var flag in flags)
        {
            using var document = JsonDocument.Parse(flag);
            clientSdkFlags.Add(await GetClientSdkFlagAsync(document.RootElement, user));
        }

        return new ClientSdkPayload(DataSyncEventTypes.Patch, user.KeyId, clientSdkFlags);
    }

    private async Task<ClientSdkFlag> GetClientSdkFlagAsync(JsonElement flag, EndUser user)
    {
        var variations =
            flag.GetProperty("variations").Deserialize<Variation[]>(ReusableJsonSerializerOptions.Web)!;

        var scope = new EvaluationScope(flag, user, variations);
        var userVariation = await _evaluationService.EvaluateAsync(scope);

        return new ClientSdkFlag(flag, userVariation, variations);
    }

    #endregion

    #region get server sdk payload

    private ServerSdkPayload GetServerSdkFlagChangePayload(JsonElement flag)
    {
        return new ServerSdkPayload(
            DataSyncEventTypes.Patch,
            new[] { JsonObject.Create(flag)! },
            Array.Empty<JsonObject>()
        );
    }

    private ServerSdkPayload GetServerSdkSegmentChangePayload(JsonElement segment)
    {
        return new ServerSdkPayload(
            DataSyncEventTypes.Patch,
            Array.Empty<JsonObject>(),
            new[] { JsonObject.Create(segment)! }
        );
    }

    #endregion
}