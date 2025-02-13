using Domain.EndUsers;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Persistence.EntityFrameworkCore.Configurations;

public class GlobalUserConfiguration : IEntityTypeConfiguration<GlobalUser>
{
    public void Configure(EntityTypeBuilder<GlobalUser> builder)
    {
        builder.ToTable("global_users");

        builder.HasIndex(x => x.WorkspaceId);

        builder.Property(x => x.CustomizedProperties).HasColumnType("jsonb");
    }
}