using Domain.ReleaseDecisions;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Persistence.EntityFrameworkCore.Configurations;

public class ReleaseDecisionMetricConfiguration : IEntityTypeConfiguration<ReleaseDecisionMetric>
{
    public void Configure(EntityTypeBuilder<ReleaseDecisionMetric> builder)
    {
        builder.ToTable("release_decision_metrics");

        builder.HasIndex(x => new { x.FeatBitEnvId, x.Key }).IsUnique();
        builder.HasIndex(x => new { x.FeatBitEnvId, x.Status });

        builder.Property(x => x.FeatBitEnvId).HasColumnName("featbit_env_id");
        builder.Property(x => x.Name).HasMaxLength(256).IsRequired();
        builder.Property(x => x.Key).HasMaxLength(128).IsRequired();
        builder.Property(x => x.MetricType).HasColumnName("metric_type").HasMaxLength(64).IsRequired();
        builder.Property(x => x.MetricAgg).HasColumnName("metric_agg").HasMaxLength(64).IsRequired();
        builder.Property(x => x.ExpectedDirection).HasColumnName("expected_direction").HasMaxLength(64).IsRequired();
        builder.Property(x => x.Status).HasMaxLength(64).IsRequired();
    }
}
