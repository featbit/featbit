using Domain.ExperimentMetrics;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Persistence.EntityFrameworkCore.Configurations;

public class ExperimentMetricConfiguration : IEntityTypeConfiguration<ExperimentMetric>
{
    public void Configure(EntityTypeBuilder<ExperimentMetric> builder)
    {
        builder.ToTable("experiment_metrics");

        builder.HasIndex(x => x.EnvId);

        builder.Property(x => x.Name).HasMaxLength(128).IsRequired();
        builder.Property(x => x.EventName).HasMaxLength(128).IsRequired();
        builder.Property(x => x.EventType).IsRequired();
        builder.Property(x => x.CustomEventTrackOption).IsRequired();
        builder.Property(x => x.CustomEventUnit).HasMaxLength(128);
        builder.Property(x => x.CustomEventSuccessCriteria).IsRequired();
        builder.Property(x => x.IsArvhived).IsRequired();

        builder.Property(x => x.TargetUrls).HasColumnType("jsonb");
    }
}