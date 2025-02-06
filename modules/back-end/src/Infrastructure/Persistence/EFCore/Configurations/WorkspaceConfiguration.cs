using Domain.Workspaces;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Persistence.EFCore.Configurations;

public class WorkspaceConfiguration : IEntityTypeConfiguration<Workspace>
{
    public void Configure(EntityTypeBuilder<Workspace> builder)
    {
        builder.Property(x => x.Name)
            .HasMaxLength(32)
            .IsRequired();

        builder.Property(x => x.Key)
            .HasMaxLength(64)
            .IsRequired();

        builder.Property(x => x.Sso)
            .HasColumnType("jsonb");
    }
}