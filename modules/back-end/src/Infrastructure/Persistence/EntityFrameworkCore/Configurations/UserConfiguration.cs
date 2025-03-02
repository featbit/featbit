using Domain.Users;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Persistence.EntityFrameworkCore.Configurations;

public class UserConfiguration : IEntityTypeConfiguration<User>
{
    public void Configure(EntityTypeBuilder<User> builder)
    {
        builder.ToTable("users");

        builder.HasIndex(x => new { x.WorkspaceId, x.Email }).IsUnique();

        builder.Property(x => x.Name).HasMaxLength(128).IsRequired();
        builder.Property(x => x.Email).HasMaxLength(256).IsRequired();
        builder.Property(x => x.Password).IsRequired();
        builder.Property(x => x.Origin).HasMaxLength(64);
    }
}