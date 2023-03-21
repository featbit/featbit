using System.Text.Json;
using Domain.EndUsers;
using Domain.Protocol;
using Domain.WebSockets;

namespace Domain.Services;

public interface IDataSyncService
{
    Task<object> GetPayloadAsync(Connection connection, DataSyncMessage message);

    Task<ClientSdkPayload> GetClientSdkPayloadAsync(Guid envId, EndUser user, long timestamp);

    Task<ServerSdkPayload> GetServerSdkPayloadAsync(Guid envId, long timestamp);

    Task<object> GetFlagChangePayloadAsync(Connection connection, JsonElement flag);

    Task<object> GetSegmentChangePayloadAsync(Connection connection, JsonElement segment, string[] affectedFlagIds);
}