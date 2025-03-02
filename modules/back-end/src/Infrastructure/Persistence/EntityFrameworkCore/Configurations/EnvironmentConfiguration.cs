using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Environment = Domain.Environments.Environment;

namespace Infrastructure.Persistence.EntityFrameworkCore.Configurations;

public class EnvironmentConfiguration : IEntityTypeConfiguration<Environment>
{
    public void Configure(EntityTypeBuilder<Environment> builder)
    {
        builder.ToTable("environments");

        builder.HasIndex(x => x.ProjectId);

        builder.Property(x => x.Name).HasMaxLength(128).IsRequired();
        builder.Property(x => x.Key).HasMaxLength(128).IsRequired();

        builder.Property(x => x.Secrets).HasColumnType("jsonb");
        builder.Property(x => x.Settings).HasColumnType("jsonb");
    }
}