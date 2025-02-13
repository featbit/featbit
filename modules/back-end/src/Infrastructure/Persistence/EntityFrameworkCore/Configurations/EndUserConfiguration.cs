using Domain.EndUsers;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Persistence.EntityFrameworkCore.Configurations;

public class EndUserConfiguration : IEntityTypeConfiguration<EndUser>
{
    public void Configure(EntityTypeBuilder<EndUser> builder)
    {
        builder.ToTable("end_users");

        builder.HasIndex(x => x.EnvId);
        builder.HasIndex(x => x.UpdatedAt);

        builder.Property(x => x.KeyId).HasMaxLength(512).IsRequired();
        builder.Property(x => x.Name).HasMaxLength(256).IsRequired();

        builder.Property(x => x.CustomizedProperties).HasColumnType("jsonb");
    }
}