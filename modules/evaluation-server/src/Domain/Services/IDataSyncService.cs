using Domain.Protocol;
using Domain.WebSockets;

namespace Domain.Services;

public interface IDataSyncService
{
    Task<ServerMessage> GetResponseAsync(Connection connection, DataSyncMessage message);
}