using Domain.Users;
using Domain.Workspaces;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Persistence.EFCore.Configurations;

public class UserConfiguration : IEntityTypeConfiguration<User>
{
    
    public void Configure(EntityTypeBuilder<User> builder)
    {
        builder.HasOne(typeof(Workspace))
            .WithMany()
            .HasForeignKey(nameof(User.WorkspaceId));

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