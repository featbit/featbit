using Domain.Workspaces;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Persistence.EntityFrameworkCore.Configurations;

public class WorkspaceConfiguration : IEntityTypeConfiguration<Workspace>
{
    public void Configure(EntityTypeBuilder<Workspace> builder)
    {
        builder.ToTable("workspaces");

        builder.Property(x => x.Name).HasMaxLength(128).IsRequired();
        builder.Property(x => x.Key).HasMaxLength(128).IsRequired();

        builder.Property(x => x.Sso).HasColumnType("jsonb");
    }
}