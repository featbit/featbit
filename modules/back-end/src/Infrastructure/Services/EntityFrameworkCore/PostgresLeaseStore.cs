using Application.ControlPlane;
using Domain.ControlPlane;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Services.EntityFrameworkCore;

/// <summary>
/// Entity Framework Core / Postgres implementation of <see cref="ILeaseStore"/>.
/// Backs the control-plane live-set and watermark tracking with the <c>dc_leases</c> table.
/// </summary>
public class PostgresLeaseStore(AppDbContext dbContext) : ILeaseStore
{
    private DbSet<DcLease> Leases => dbContext.Set<DcLease>();

    public async Task UpsertLeaseAsync(DcLease lease)
    {
        // Upsert keyed by DcId so repeated heartbeats for the same data center replace the
        // existing row instead of inserting duplicates. The query is run with tracking so the
        // change tracker can issue an UPDATE (or INSERT) regardless of the context default.
        var existing = await Leases
            .AsTracking()
            .FirstOrDefaultAsync(x => x.DcId == lease.DcId);

        if (existing == null)
        {
            await Leases.AddAsync(lease);
        }
        else
        {
            existing.Region = lease.Region;
            existing.LastHeartbeatAt = lease.LastHeartbeatAt;
            existing.LeaseExpiresAt = lease.LeaseExpiresAt;
            existing.AppliedWatermarks = lease.AppliedWatermarks;
        }

        await dbContext.SaveChangesAsync();
    }

    public async Task<IReadOnlyList<DcLease>> GetLiveSetAsync(DateTimeOffset now)
    {
        var leases = await Leases
            .Where(x => x.LeaseExpiresAt > now)
            .ToListAsync();

        return leases;
    }

    public async Task UpdateAppliedWatermarkAsync(string dcId, Guid envId, long version)
    {
        var lease = await Leases
            .AsTracking()
            .FirstOrDefaultAsync(x => x.DcId == dcId);

        if (lease == null)
        {
            return;
        }

        // Reassign the dictionary so EF detects the jsonb column as modified even when the
        // context is configured for change tracking on a reference-typed property.
        var watermarks = new Dictionary<Guid, long>(lease.AppliedWatermarks)
        {
            [envId] = version
        };
        lease.AppliedWatermarks = watermarks;

        await dbContext.SaveChangesAsync();
    }
}
