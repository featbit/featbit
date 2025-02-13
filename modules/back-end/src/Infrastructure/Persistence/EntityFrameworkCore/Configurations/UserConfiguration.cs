using Domain.Users;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Persistence.EntityFrameworkCore.Configurations;

public class UserConfiguration : IEntityTypeConfiguration<User>
{
    
    public void Configure(EntityTypeBuilder<User> builder)
    {
        builder.HasIndex(x => x.WorkspaceId);

        builder.Property(x => x.Name)
            .HasMaxLength(255)
            .IsRequired();
        builder.Property(x => x.Email)
            .HasMaxLength(255)
            .IsRequired();
        builder.Property(x => x.Password)
            .IsRequired();
        builder.Property(x => x.Origin)
            .HasMaxLength(255);
    }
}