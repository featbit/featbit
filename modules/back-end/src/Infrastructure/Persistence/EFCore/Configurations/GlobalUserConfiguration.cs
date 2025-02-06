using Domain.EndUsers;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Persistence.EFCore.Configurations;

public class GlobalUserConfiguration : IEntityTypeConfiguration<GlobalUser>
{
    
    public void Configure(EntityTypeBuilder<GlobalUser> builder)
    {
        builder.HasIndex(x => x.WorkspaceId);
        builder.HasIndex(x => x.EnvId);

        builder.Property(x => x.CustomizedProperties).HasColumnType("jsonb");
    }
}