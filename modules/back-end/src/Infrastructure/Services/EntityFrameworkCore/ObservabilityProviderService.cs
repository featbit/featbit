using Application.Bases.Exceptions;
using Domain.ObservabilityProviders;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace Infrastructure.Services.EntityFrameworkCore;

public class ObservabilityProviderService(AppDbContext dbContext) : IObservabilityProviderService
{
    private IQueryable<ObservabilityProvider> Active(Guid envId) =>
        dbContext.Set<ObservabilityProvider>().AsNoTracking().Where(x => x.EnvId == envId && !x.IsDeleted);

    public async Task<IReadOnlyList<ObservabilityProvider>> GetListAsync(Guid envId, CancellationToken ct) =>
        await Active(envId).OrderBy(x => x.Name).ToListAsync(ct);

    public Task<ObservabilityProvider?> FindAsync(Guid envId, Guid id, CancellationToken ct) =>
        Active(envId).FirstOrDefaultAsync(x => x.Id == id, ct);

    public async Task AddAsync(ObservabilityProvider provider, CancellationToken ct)
    {
        var entry = dbContext.Add(provider);
        try
        {
            await dbContext.SaveChangesAsync(ct);
        }
        catch (DbUpdateException ex) when (ex.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation })
        {
            throw new ConflictException(nameof(ObservabilityProvider), provider.Id);
        }
        finally
        {
            entry.State = EntityState.Detached;
        }
    }

    public async Task<bool> UpdateAsync(ObservabilityProvider provider, long expectedVersion, CancellationToken ct)
    {
        try
        {
            var updated = await Active(provider.EnvId)
                .Where(x => x.Id == provider.Id && x.Version == expectedVersion)
                .ExecuteUpdateAsync(s => s
                    .SetProperty(x => x.Name, provider.Name)
                    .SetProperty(x => x.ProviderType, provider.ProviderType)
                    .SetProperty(x => x.ProviderSchemaVersion, provider.ProviderSchemaVersion)
                    .SetProperty(x => x.ConnectionConfiguration, provider.ConnectionConfiguration)
                    .SetProperty(x => x.ProtectedCredential, provider.ProtectedCredential)
                    .SetProperty(x => x.Revision, provider.Revision)
                    .SetProperty(x => x.Version, provider.Version)
                    .SetProperty(x => x.UpdatorId, provider.UpdatorId)
                    .SetProperty(x => x.UpdatedAt, provider.UpdatedAt), ct);
            return updated == 1;
        }
        catch (PostgresException ex) when (ex.SqlState == PostgresErrorCodes.UniqueViolation)
        {
            throw new ConflictException(nameof(ObservabilityProvider), provider.Id);
        }
    }

    public async Task<bool> DeleteAsync(Guid envId, Guid id, Guid operatorId, CancellationToken ct)
    {
        var deleted = await Active(envId).Where(x => x.Id == id).ExecuteUpdateAsync(s => s
            .SetProperty(x => x.IsDeleted, true)
            .SetProperty(x => x.ProtectedCredential, (string?)null)
            .SetProperty(x => x.Version, x => x.Version + 1)
            .SetProperty(x => x.UpdatorId, operatorId)
            .SetProperty(x => x.UpdatedAt, DateTime.UtcNow), ct);
        return deleted == 1;
    }
}
