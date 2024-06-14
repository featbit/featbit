using Domain.DataSync;

namespace Application.Services;

public interface IDataSyncService
{
    Task<SyncData> GetSyncDataAsync(Guid envId);

    Task<RemoteSyncPayload> GetRemoteSyncPayloadAsync(Guid envId);
}