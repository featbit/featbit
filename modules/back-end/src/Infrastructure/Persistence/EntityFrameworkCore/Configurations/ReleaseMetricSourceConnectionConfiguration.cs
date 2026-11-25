using Domain.ReleaseMetricSourceConnections;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Persistence.EntityFrameworkCore.Configurations;

public class ReleaseMetricSourceConnectionConfiguration : IEntityTypeConfiguration<ReleaseMetricSourceConnection>
{
    public void Configure(EntityTypeBuilder<ReleaseMetricSourceConnection> builder)
    {
        builder.ToTable("release_metric_source_connections");
        builder.HasIndex(x => x.EnvId).HasFilter("NOT is_deleted");

        builder.Property(x => x.Name).HasMaxLength(256).IsRequired();
        builder.Property(x => x.ProviderType).HasMaxLength(64).IsRequired();
        builder.Property(x => x.ConnectionConfiguration).HasColumnType("jsonb").IsRequired();
        builder.Property(x => x.ProtectedCredential).IsRequired(false);
    }
}
