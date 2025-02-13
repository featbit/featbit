using Domain.Experiments;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Persistence.EntityFrameworkCore.Configurations;

public class ExperimentConfiguration : IEntityTypeConfiguration<Experiment>
{
    public void Configure(EntityTypeBuilder<Experiment> builder)
    {
        builder.HasIndex(x => x.EnvId);

        builder.Property(x => x.IsArchived).IsRequired();
        builder.Property(x => x.Status).HasMaxLength(255).IsRequired();
        builder.Property(x => x.BaselineVariationId).HasMaxLength(255);
        builder.Property(x => x.Alpha).HasPrecision(5, 2);

        builder.Property(x => x.Iterations).HasColumnType("jsonb");
    }
}