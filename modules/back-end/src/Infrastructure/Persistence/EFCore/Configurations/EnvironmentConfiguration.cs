using Domain.Projects;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Environment = Domain.Environments.Environment;

namespace Infrastructure.Persistence.EFCore.Configurations;

public class EnvironmentConfiguration : IEntityTypeConfiguration<Environment>
{
    public void Configure(EntityTypeBuilder<Environment> builder)
    {
        builder.HasOne(typeof(Project))
            .WithMany()
            .HasForeignKey(nameof(Environment.ProjectId));

        builder.Property(x => x.Name)
            .HasMaxLength(64)
            .IsRequired();

        builder.Property(x => x.Key)
            .HasMaxLength(64)
            .IsRequired();

        builder.Property(x => x.Description)
            .HasMaxLength(512);

        builder.Property(x => x.Secrets)
            .HasColumnType("jsonb");

        builder.Property(x => x.Settings)
            .HasColumnType("jsonb");
    }
}