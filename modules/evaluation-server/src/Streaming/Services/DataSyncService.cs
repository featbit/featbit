using System.Text.Json;
using System.Text.Json.Nodes;
using Domain.EndUsers;
using Domain.Evaluation;
using Domain.Shared;
using Streaming.Connections;
using Streaming.Protocol;

namespace Streaming.Services;

public class DataSyncService(IStore store, IEvaluator evaluator, IRelayProxyService rpService) : IDataSyncService
{
    public async Task<object> GetPayloadAsync(ConnectionContext connectionContext, JsonElement request)
    {
        var connection = connectionContext.Connection;

        long timestamp;
        if (request.TryGetProperty("timestamp", out var timestampProp))
        {
            timestampProp.TryGetInt64(out timestamp);
        }
        else
        {
            // if timestamp is null or not specified, treat as 0 (default value)
            timestamp = 0;
        }

        object payload = connectionContext.Type switch
        {
            ConnectionType.Client => await GetClientSdkPayloadAsync(connection.EnvId, connection.User!, timestamp),
            ConnectionType.Server => await GetServerSdkPayloadAsync(connection.EnvId, timestamp),
            ConnectionType.RelayProxy => await GetRelayProxyPayloadAsync(connectionContext.Token, timestamp, request),
            _ => throw new ArgumentOutOfRangeException(
                nameof(connection.Type), $"unsupported connection type {connection.Type}"
            )
        };

        return payload;
    }

    public async Task<ClientSdkPayload> GetClientSdkPayloadAsync(Guid envId, EndUser user, long timestamp)
    {
        var eventType = timestamp == 0 ? DataSyncEventTypes.Full : DataSyncEventTypes.Patch;
        var flagsBytes = await store.GetFlagsAsync(envId, timestamp);

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

        var flagsBytes = await store.GetFlagsAsync(envId, timestamp);
        foreach (var flag in flagsBytes)
        {
            var jsonObject = JsonNode.Parse(flag)!.AsObject();
            featureFlags.Add(jsonObject);
        }

        var segmentsBytes = await store.GetSegmentsAsync(envId, timestamp);
        foreach (var segment in segmentsBytes)
        {
            var jsonObject = JsonNode.Parse(segment)!.AsObject();
            segments.Add(jsonObject);
        }

        return new ServerSdkPayload(eventType, featureFlags, segments);
    }

    private async Task<RpPayload> GetRelayProxyPayloadAsync(string token, long timestamp, JsonElement request)
    {
        var eventType = timestamp == 0 ? DataSyncEventTypes.Full : DataSyncEventTypes.Patch;

        var timestampPerEnv = new Dictionary<Guid, long>();
        if (request.TryGetProperty("envs", out var envs))
        {
            foreach (var env in envs.EnumerateArray())
            {
                var envId = env.GetProperty("envId").GetGuid();
                var ts = env.GetProperty("timestamp").GetInt64();

                timestampPerEnv[envId] = ts;
            }
        }

        List<RpPayloadItem> items = [];

        var rpSecrets = await rpService.GetSecretSlimsAsync(token);
        var groupedRpSecrets = rpSecrets.GroupBy(x => x.EnvId);

        foreach (var group in groupedRpSecrets)
        {
            var envId = group.Key;
            var ts = timestampPerEnv.GetValueOrDefault(envId, 0);
            var serverSdkPayload = await GetServerSdkPayloadAsync(envId, ts);

            var payload = new RpPayloadItem(
                envId,
                group.ToArray(),
                serverSdkPayload.FeatureFlags,
                serverSdkPayload.Segments
            );

            items.Add(payload);
        }

        return new RpPayload(eventType, items);
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
            [await GetClientSdkFlagAsync(flag, user)]
        );
    }

    private async Task<ClientSdkPayload> GetClientSegmentChangePayloadAsync(string[] affectedFlagIds, EndUser user)
    {
        var clientSdkFlags = new List<ClientSdkFlag>();

        var flags = await store.GetFlagsAsync(affectedFlagIds);
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
        var userVariation = await evaluator.EvaluateAsync(scope);

        return new ClientSdkFlag(flag, userVariation, variations);
    }

    #endregion

    #region get server sdk payload

    private static ServerSdkPayload GetServerSdkFlagChangePayload(JsonElement flag)
    {
        return new ServerSdkPayload(
            DataSyncEventTypes.Patch,
            [JsonObject.Create(flag)!],
            []
        );
    }

    private static ServerSdkPayload GetServerSdkSegmentChangePayload(JsonElement segment)
    {
        return new ServerSdkPayload(
            DataSyncEventTypes.Patch,
            [],
            [JsonObject.Create(segment)!]
        );
    }

    #endregion
}