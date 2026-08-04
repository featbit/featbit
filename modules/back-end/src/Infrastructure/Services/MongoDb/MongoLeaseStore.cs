using Application.ControlPlane;
using Domain.ControlPlane;
using MongoDB.Driver;

namespace Infrastructure.Services.MongoDb;

public class MongoLeaseStore : ILeaseStore
{
    public const string CollectionName = "dc_leases";

    private readonly IMongoCollection<DcLease> _collection;

    public MongoLeaseStore(MongoDbClient mongoDb)
    {
        _collection = mongoDb.Database.GetCollection<DcLease>(CollectionName);
    }

    public async Task UpsertLeaseAsync(DcLease lease)
    {
        var filter = Builders<DcLease>.Filter.Eq(x => x.DcId, lease.DcId);
        await _collection.ReplaceOneAsync(filter, lease, new ReplaceOptions { IsUpsert = true });
    }

    public async Task<IReadOnlyList<DcLease>> GetLiveSetAsync(DateTimeOffset now)
    {
        var filter = Builders<DcLease>.Filter.Gt(x => x.LeaseExpiresAt, now);
        var leases = await _collection.Find(filter).ToListAsync();
        return leases;
    }

    public async Task UpdateAppliedWatermarkAsync(string dcId, Guid envId, long version)
    {
        var filter = Builders<DcLease>.Filter.Eq(x => x.DcId, dcId);
        var update = Builders<DcLease>.Update.Set($"appliedWatermarks.{envId}", version);
        await _collection.UpdateOneAsync(filter, update);
    }
}
