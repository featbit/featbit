using System.Data;
using System.Text.Json;
using Application.ControlPlane;
using Dapper;
using Domain.ControlPlane;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Services.EntityFrameworkCore;

/// <summary>
/// Entity Framework Core / Postgres implementation of <see cref="ILeaseStore"/>.
/// Backs the control-plane live-set and watermark tracking with the <c>dc_leases</c> table.
/// </summary>
public class PostgresLeaseStore(AppDbContext dbContext) : ILeaseStore
{
    private IDbConnection DbConnection => dbContext.Database.GetDbConnection();

    public async Task UpsertLeaseAsync(DcLease lease)
    {
        var watermarksJson = JsonSerializer.Serialize(lease.AppliedWatermarks);

        await DbConnection.ExecuteAsync(
            """
            INSERT INTO dc_leases (dc_id, region, last_heartbeat_at, lease_expires_at, applied_watermarks)
            VALUES (@DcId, @Region, @LastHeartbeatAt, @LeaseExpiresAt, @AppliedWatermarks::jsonb)
            ON CONFLICT (dc_id) DO UPDATE SET
                region = EXCLUDED.region,
                last_heartbeat_at = EXCLUDED.last_heartbeat_at,
                lease_expires_at = EXCLUDED.lease_expires_at,
                applied_watermarks = EXCLUDED.applied_watermarks
            """,
            new
            {
                lease.DcId,
                lease.Region,
                lease.LastHeartbeatAt,
                lease.LeaseExpiresAt,
                AppliedWatermarks = watermarksJson
            }
        );
    }

    public async Task<IReadOnlyList<DcLease>> GetLiveSetAsync(DateTimeOffset now)
    {
        var rows = await DbConnection.QueryAsync(
            """
            SELECT dc_id, region, last_heartbeat_at, lease_expires_at, applied_watermarks
            FROM dc_leases
            WHERE lease_expires_at > @Now
            """,
            new { Now = now }
        );

        return rows
            .Select(row => (IDictionary<string, object>)row)
            .Select(row => new DcLease
            {
                DcId = (string)row["dc_id"],
                Region = (string)row["region"],
                // Npgsql read `timestamp with time zone` as `DateTime` with `DateTimeKind.Utc`
                LastHeartbeatAt = (DateTime)row["last_heartbeat_at"],
                LeaseExpiresAt = (DateTime)row["lease_expires_at"],
                AppliedWatermarks = row["applied_watermarks"] is string json
                    ? JsonSerializer.Deserialize<Dictionary<Guid, long>>(json) ?? new Dictionary<Guid, long>()
                    : new Dictionary<Guid, long>()
            }).ToArray();
    }

    public async Task UpdateAppliedWatermarkAsync(string dcId, Guid envId, long version)
    {
        await DbConnection.ExecuteAsync(
            """
            UPDATE dc_leases
            SET applied_watermarks = jsonb_set(
                coalesce(applied_watermarks, '{}'::jsonb),
                ARRAY[@EnvId]::text[],
                to_jsonb(@Version::bigint),
                true
            )
            WHERE dc_id = @DcId
            """,
            new
            {
                DcId = dcId,
                EnvId = envId.ToString(),
                Version = version
            }
        );
    }
}
