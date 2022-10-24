using System.Text.Json;
using Domain.Protocol;
using Domain.WebSockets;

namespace Domain.Services;

public interface IDataSyncService
{
    Task<object> GetPayloadAsync(Connection connection, DataSyncMessage message);

    Task<object> GetFlagChangePayloadAsync(Connection connection, JsonElement flag);
}