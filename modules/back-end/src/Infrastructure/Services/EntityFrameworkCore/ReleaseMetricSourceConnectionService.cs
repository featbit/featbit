using Application.Bases.Exceptions;
using Domain.ReleaseMetricSourceConnections;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace Infrastructure.Services.EntityFrameworkCore;

public class ReleaseMetricSourceConnectionService(AppDbContext dbContext)
    : EntityFrameworkCoreService<ReleaseMetricSourceConnection>(dbContext), IReleaseMetricSourceConnectionService
{
    private IQueryable<ReleaseMetricSourceConnection> Active(Guid envId) =>
        Queryable.AsNoTracking().Where(x => x.EnvId == envId && !x.IsDeleted);

    public async Task<IReadOnlyList<ReleaseMetricSourceConnection>> GetListAsync(Guid envId, CancellationToken ct) =>
        await Active(envId).OrderBy(x => x.Name).ToListAsync(ct);

    public Task<ReleaseMetricSourceConnection?> FindAsync(Guid envId, Guid id, CancellationToken ct) =>
        Active(envId).FirstOrDefaultAsync(x => x.Id == id, ct);

    public async Task AddAsync(ReleaseMetricSourceConnection connection, CancellationToken ct)
    {
        var entry = Set.Add(connection);
        try
        {
            await DbContext.SaveChangesAsync(ct);
        }
        catch (DbUpdateException ex) when (ex.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation })
        {
            throw new ConflictException(nameof(ReleaseMetricSourceConnection), connection.Id);
        }
        finally
        {
            entry.State = EntityState.Detached;
        }
    }

    public async Task<bool> UpdateAsync(ReleaseMetricSourceConnection connection, DateTime previousUpdatedAt, CancellationToken ct)
    {
        var updated = await Active(connection.EnvId)
            .Where(x => x.Id == connection.Id && x.UpdatedAt == previousUpdatedAt)
            .ExecuteUpdateAsync(s => s
                .SetProperty(x => x.Name, connection.Name)
                .SetProperty(x => x.ProviderType, connection.ProviderType)
                .SetProperty(x => x.ConnectionConfiguration, connection.ConnectionConfiguration)
                .SetProperty(x => x.ProtectedCredential, connection.ProtectedCredential)
                .SetProperty(x => x.UpdatedAt, connection.UpdatedAt), ct);

        return updated == 1;
    }

    public async Task<bool> DeleteAsync(Guid envId, Guid id, CancellationToken ct)
    {
        var deleted = await Active(envId).Where(x => x.Id == id).ExecuteUpdateAsync(s => s
            .SetProperty(x => x.IsDeleted, true)
            .SetProperty(x => x.ProtectedCredential, (string?)null)
            .SetProperty(x => x.UpdatedAt, DateTime.UtcNow), ct);
        return deleted == 1;
    }
}
