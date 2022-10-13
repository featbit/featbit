using Domain.DataSync;
using Domain.EndUsers;
using Domain.FeatureFlags;
using Domain.Segments;
using Microsoft.Extensions.Logging;
using MongoDB.Driver;
using MongoDB.Driver.Linq;

namespace Infrastructure.DataSync;

public class DataSyncService : IDataSyncService
{
    private readonly MongoDbClient _mongoDb;
    private readonly ILogger<DataSyncService> _logger;

    public DataSyncService(MongoDbClient mongoDb, ILogger<DataSyncService> logger)
    {
        _mongoDb = mongoDb;
        _logger = logger;
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

    public async Task SaveAsync(Guid envId, SyncData data)
    {
        // upsert end-user
        await UpsertUsersAsync(envId, data.Users);

        // add new user property
        await AddNewPropsAsync(envId, data.UserProperties);
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

    private async Task UpsertUsersAsync(Guid envId, IEnumerable<EndUserSyncData> inputUsers)
    {
        var existUsers = await _mongoDb.QueryableOf<EndUser>()
            .Where(x => x.EnvId == envId)
            .ToListAsync();

        // https://www.mongodb.com/docs/manual/reference/method/db.collection.bulkWrite/
        var writeModels = new List<WriteModel<EndUser>>();
        foreach (var inputUser in inputUsers)
        {
            var existing = existUsers.FirstOrDefault(x => x.KeyId == inputUser.KeyId);
            if (existing == null)
            {
                // insert new user
                var endUser = inputUser.AsEndUser(envId);
                var insertOneModel = new InsertOneModel<EndUser>(endUser);

                writeModels.Add(insertOneModel);
            }
            else
            {
                // no need to update if value equals
                if (existing.ValueEquals(inputUser.AsEndUser(envId)))
                {
                    continue;
                }

                // update existing user
                var filter = Builders<EndUser>.Filter.And(
                    Builders<EndUser>.Filter.Eq(x => x.EnvId, envId),
                    Builders<EndUser>.Filter.Eq(x => x.KeyId, inputUser.KeyId)
                );

                var update = Builders<EndUser>.Update
                    .Set(x => x.Name, inputUser.Name)
                    .Set(x => x.CustomizedProperties, inputUser.CustomizedProperties);

                var updateOneModel = new UpdateOneModel<EndUser>(filter, update);
                writeModels.Add(updateOneModel);
            }
        }

        if (writeModels.Any())
        {
            var result = await _mongoDb.CollectionOf<EndUser>().BulkWriteAsync(writeModels);
            if (!result.IsAcknowledged)
            {
                throw new Exception($"failed to upsert users when sync env users by local data, envId: {envId}");
            }

            _logger.LogInformation(
                "sync end users by local data success, envId: {EnvId}, inserted count: {InsertedCount}, updated count: {ModifiedCount}, request count: {RequestCount}, ",
                envId, result.InsertedCount, result.ModifiedCount, result.RequestCount
            );
        }
        else
        {
            _logger.LogInformation(
                "sync env users by local data finished with no data upserted, envId: {EnvId}", envId
            );
        }
    }

    private async Task AddNewPropsAsync(Guid envId, IEnumerable<string> propNames)
    {
        var existingPropNames = await _mongoDb.QueryableOf<EndUserProperty>()
            .Where(x => x.EnvId == envId)
            .Select(x => x.Name)
            .ToListAsync();

        var newProps = propNames
            .Where(propName => !existingPropNames.Contains(propName))
            .Select(propName => new EndUserProperty(envId, propName, Array.Empty<EndUserPresetValue>()))
            .ToList();

        if (newProps.Any())
        {
            await _mongoDb.CollectionOf<EndUserProperty>().InsertManyAsync(newProps);
        }

        _logger.LogInformation(
            "sync end-user properties by local data success, envId: {EnvId}, added count: {Count}",
            envId, newProps.Count
        );
    }
}