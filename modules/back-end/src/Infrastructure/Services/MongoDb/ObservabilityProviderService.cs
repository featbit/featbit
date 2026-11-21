using Application.Bases.Exceptions;
using Domain.ObservabilityProviders;
using MongoDB.Driver;

namespace Infrastructure.Services.MongoDb;

public class ObservabilityProviderService(MongoDbClient mongoDb) : IObservabilityProviderService
{
    private IMongoCollection<ObservabilityProvider> Collection => mongoDb.CollectionOf<ObservabilityProvider>();

    public async Task<IReadOnlyList<ObservabilityProvider>> GetListAsync(Guid envId, CancellationToken ct) =>
        await Collection.Find(x => x.EnvId == envId && !x.IsDeleted).SortBy(x => x.Name).ToListAsync(ct);

    public async Task<ObservabilityProvider?> FindAsync(Guid envId, Guid id, CancellationToken ct) =>
        await Collection.Find(x => x.EnvId == envId && x.Id == id && !x.IsDeleted).FirstOrDefaultAsync(ct);

    public async Task AddAsync(ObservabilityProvider provider, CancellationToken ct)
    {
        try
        {
            await Collection.InsertOneAsync(provider, cancellationToken: ct);
        }
        catch (MongoWriteException ex) when (ex.WriteError.Category == ServerErrorCategory.DuplicateKey)
        {
            throw new ConflictException(nameof(ObservabilityProvider), provider.Id);
        }
    }

    public async Task<bool> UpdateAsync(ObservabilityProvider provider, long expectedVersion, CancellationToken ct)
    {
        try
        {
            var result = await Collection.ReplaceOneAsync(
                x => x.EnvId == provider.EnvId && x.Id == provider.Id && !x.IsDeleted && x.Version == expectedVersion,
                provider, cancellationToken: ct);
            return result.MatchedCount == 1;
        }
        catch (MongoWriteException ex) when (ex.WriteError.Category == ServerErrorCategory.DuplicateKey)
        {
            throw new ConflictException(nameof(ObservabilityProvider), provider.Id);
        }
    }

    public async Task<bool> DeleteAsync(Guid envId, Guid id, Guid operatorId, CancellationToken ct)
    {
        var update = Builders<ObservabilityProvider>.Update
            .Set(x => x.IsDeleted, true)
            .Set(x => x.ProtectedCredential, null)
            .Inc(x => x.Version, 1)
            .Set(x => x.UpdatorId, operatorId)
            .Set(x => x.UpdatedAt, DateTime.UtcNow);
        var result = await Collection.UpdateOneAsync(x => x.EnvId == envId && x.Id == id && !x.IsDeleted,
            update, cancellationToken: ct);
        return result.MatchedCount == 1;
    }
}
