using Domain.ControlPlane;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Persistence.EntityFrameworkCore.Configurations;

public class DcLeaseConfiguration : IEntityTypeConfiguration<DcLease>
{
    public void Configure(EntityTypeBuilder<DcLease> builder)
    {
        builder.ToTable("dc_leases");

        // DcId is the natural key for a data center membership lease (one row per DC).
        builder.HasKey(x => x.DcId);
        builder.Property(x => x.DcId).IsRequired();

        builder.Property(x => x.Region);
        builder.Property(x => x.LastHeartbeatAt);
        builder.Property(x => x.LeaseExpiresAt);

        // The per-environment applied watermark map is stored as jsonb, mirroring how other
        // complex/dictionary properties (e.g. EndUser.CustomizedProperties) are mapped. Npgsql's
        // dynamic-json support serializes the Dictionary<Guid, long> to/from the jsonb column.
        builder.Property(x => x.AppliedWatermarks).HasColumnType("jsonb");
    }
}
