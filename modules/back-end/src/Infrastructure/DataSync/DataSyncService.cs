using Domain.DataSync;
using Domain.EndUsers;
using Domain.FeatureFlags;
using Domain.Segments;
using MongoDB.Driver;
using MongoDB.Driver.Linq;

namespace Infrastructure.DataSync;

public class DataSyncService : IDataSyncService
{
    private readonly MongoDbClient _mongoDb;

    public DataSyncService(MongoDbClient mongoDb)
    {
        _mongoDb = mongoDb;
    }

    public async Task<SyncData> GetSyncDataAsync(Guid envId)
    {
        var users = await _mongoDb.QueryableOf<EndUser>()
            .Where(x => x.EnvId == envId)
            .ToListAsync();

        var properties = await _mongoDb.QueryableOf<EndUserProperty>()
            .Where(x => x.EnvId == envId)
            .ToListAsync();

        var data = new SyncData
        {
            Date = DateTime.UtcNow,
            Users = users.Select(x => new EndUserSyncData
            {
                KeyId = x.KeyId,
                Name = x.Name,
                CustomizedProperties = x.CustomizedProperties
            }),
            UserProperties = properties.Select(x => x.Name)
        };

        return data;
    }

    public async Task<RemoteSyncPayload> GetRemoteSyncPayloadAsync(Guid envId)
    {
        var flags = await _mongoDb.QueryableOf<FeatureFlag>()
            .Where(x => x.EnvId == envId && !x.IsArchived)
            .ToListAsync();

        var segments = await _mongoDb.QueryableOf<Segment>()
            .Where(x => x.EnvId == envId && !x.IsArchived)
            .ToListAsync();

        var payload = new RemoteSyncPayload
        {
            FeatureFlags = flags,
            Segments = segments
        };

        return payload;
    }
}