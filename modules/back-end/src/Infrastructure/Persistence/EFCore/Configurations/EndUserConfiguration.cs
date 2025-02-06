using Domain.EndUsers;
using Domain.Workspaces;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Persistence.EFCore.Configurations;

public class EndUserConfiguration : IEntityTypeConfiguration<EndUser>
{
    
    public void Configure(EntityTypeBuilder<EndUser> builder)
    {
        builder.Property(x => x.KeyId).HasMaxLength(255).IsRequired();
        builder.Property(x => x.Name).HasMaxLength(255).IsRequired();

        builder.HasIndex(x => x.EnvId);
        builder.HasIndex(x => x.UpdatedAt);

        builder.Property(x => x.CustomizedProperties).HasColumnType("jsonb");
    }
}