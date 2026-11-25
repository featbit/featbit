using Application.Bases.Exceptions;
using Domain.ReleaseMetricSourceConnections;
using MongoDB.Driver;

namespace Infrastructure.Services.MongoDb;

public class ReleaseMetricSourceConnectionService(MongoDbClient mongoDb)
    : MongoDbService<ReleaseMetricSourceConnection>(mongoDb), IReleaseMetricSourceConnectionService
{
    // Explicit equality matches the partial index. The MongoDB driver translates !x.IsDeleted to $ne: true.
    public async Task<IReadOnlyList<ReleaseMetricSourceConnection>> GetListAsync(Guid envId, CancellationToken ct) =>
        await Collection.Find(x => x.EnvId == envId && x.IsDeleted == false).SortBy(x => x.Name).ToListAsync(ct);

    public async Task<ReleaseMetricSourceConnection?> FindAsync(Guid envId, Guid id, CancellationToken ct) =>
        await Collection.Find(x => x.EnvId == envId && x.Id == id && !x.IsDeleted).FirstOrDefaultAsync(ct);

    public async Task AddAsync(ReleaseMetricSourceConnection connection, CancellationToken ct)
    {
        try
        {
            await Collection.InsertOneAsync(connection, cancellationToken: ct);
        }
        catch (MongoWriteException ex) when (ex.WriteError.Category == ServerErrorCategory.DuplicateKey)
        {
            throw new ConflictException(nameof(ReleaseMetricSourceConnection), connection.Id);
        }
    }

    public async Task<bool> UpdateAsync(ReleaseMetricSourceConnection connection, DateTime previousUpdatedAt, CancellationToken ct)
    {
        var update = Builders<ReleaseMetricSourceConnection>.Update
            .Set(x => x.Name, connection.Name)
            .Set(x => x.ProviderType, connection.ProviderType)
            .Set(x => x.ConnectionConfiguration, connection.ConnectionConfiguration)
            .Set(x => x.ProtectedCredential, connection.ProtectedCredential)
            .Set(x => x.UpdatedAt, connection.UpdatedAt);
        var result = await Collection.UpdateOneAsync(
            x => x.EnvId == connection.EnvId && x.Id == connection.Id && !x.IsDeleted && x.UpdatedAt == previousUpdatedAt,
            update, cancellationToken: ct);

        return result.MatchedCount == 1;
    }

    public async Task<bool> DeleteAsync(Guid envId, Guid id, CancellationToken ct)
    {
        var update = Builders<ReleaseMetricSourceConnection>.Update
            .Set(x => x.IsDeleted, true)
            .Set(x => x.ProtectedCredential, null)
            .Set(x => x.UpdatedAt, DateTime.UtcNow);
        var result = await Collection.UpdateOneAsync(x => x.EnvId == envId && x.Id == id && !x.IsDeleted,
            update, cancellationToken: ct);
        return result.MatchedCount == 1;
    }
}
