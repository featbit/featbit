using Domain.Experiments;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Persistence.EntityFrameworkCore.Configurations;

public class ExperimentConfiguration : IEntityTypeConfiguration<Experiment>
{
    public void Configure(EntityTypeBuilder<Experiment> builder)
    {
        builder.ToTable("experiments");

        builder.HasIndex(x => new { x.EnvId, x.UpdatedAt });

        builder.Property(x => x.Name).HasMaxLength(256).IsRequired();
        builder.Property(x => x.Stage).HasMaxLength(64).IsRequired();
        builder.Property(x => x.FlagId).HasColumnName("flag_id");
        builder.Property(x => x.EnvId).HasColumnName("env_id");
        builder.Property(x => x.PrimaryMetric).HasColumnName("primary_metric").HasColumnType("jsonb");
        builder.Property(x => x.GuardrailMetrics).HasColumnName("guardrail_metrics").HasColumnType("jsonb");
        builder.Property(x => x.EntryMode).HasMaxLength(64);

        builder.Ignore(x => x.ExperimentRuns);
        builder.Ignore(x => x.Activities);
    }
}
