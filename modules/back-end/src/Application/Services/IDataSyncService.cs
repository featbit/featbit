using Domain.DataSync;

namespace Application.Services;

public interface IDataSyncService
{
    Task<SyncData> GetSyncDataAsync(Guid envId);

    Task SaveAsync(Guid envId, SyncData data);
}