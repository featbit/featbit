using Domain.ExperimentMetrics;
using Domain.Users;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Persistence.EntityFrameworkCore.Configurations;

public class ExperimentMetricConfiguration : IEntityTypeConfiguration<ExperimentMetric>
{
    
    public void Configure(EntityTypeBuilder<ExperimentMetric> builder)
    {
        builder.HasOne(typeof(Domain.Environments.Environment))
            .WithMany()
            .HasForeignKey(nameof(ExperimentMetric.EnvId));
        builder.HasOne(typeof(User))
            .WithMany()
            .HasForeignKey(nameof(ExperimentMetric.MaintainerUserId));

        builder.Property(x => x.Name).HasMaxLength(255).IsRequired();
        builder.Property(x => x.EventName).HasMaxLength(255);
        builder.Property(x => x.EventType).IsRequired();
        builder.Property(x => x.CustomEventTrackOption).IsRequired();
        builder.Property(x => x.CustomEventUnit).HasMaxLength(255);
        builder.Property(x => x.CustomEventSuccessCriteria).IsRequired();
        builder.Property(x => x.IsArvhived).IsRequired();

        builder.Property(x=>x.TargetUrls).HasColumnType("jsonb");
    }
}