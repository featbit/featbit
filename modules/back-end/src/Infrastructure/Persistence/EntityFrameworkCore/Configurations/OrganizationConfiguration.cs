using Domain.Organizations;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Persistence.EntityFrameworkCore.Configurations;

public class OrganizationConfiguration : IEntityTypeConfiguration<Organization>
{
    public void Configure(EntityTypeBuilder<Organization> builder)
    {
        builder.HasIndex(x => x.WorkspaceId);

        builder.Property(x => x.Name)
            .HasMaxLength(255)
            .IsRequired();
        builder.Property(x => x.Key)
            .HasMaxLength(255)
            .IsRequired();
        builder.Property(x => x.Initialized)
            .HasDefaultValue(false)
            .IsRequired();

        builder.Property(x => x.DefaultPermissions)
            .HasColumnType("jsonb");
    }
}