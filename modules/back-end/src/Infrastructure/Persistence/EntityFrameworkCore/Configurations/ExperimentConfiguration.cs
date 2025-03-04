using Domain.Experiments;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Persistence.EntityFrameworkCore.Configurations;

public class ExperimentConfiguration : IEntityTypeConfiguration<Experiment>
{
    public void Configure(EntityTypeBuilder<Experiment> builder)
    {
        builder.ToTable("experiments");

        builder.HasIndex(x => new { x.EnvId, x.FeatureFlagId });

        builder.Property(x => x.IsArchived).IsRequired();
        builder.Property(x => x.Status).HasMaxLength(64).IsRequired();

        builder.Property(x => x.Iterations).HasColumnType("jsonb");
    }
}