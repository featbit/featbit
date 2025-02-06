using Domain.Organizations;
using Domain.Users;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Persistence.EFCore.Configurations;

public class OrganizationUserConfiguration : IEntityTypeConfiguration<OrganizationUser>
{
    
    public void Configure(EntityTypeBuilder<OrganizationUser> builder)
    {
        builder.HasOne(typeof(Organization))
            .WithMany()
            .HasForeignKey(nameof(OrganizationUser.OrganizationId));
        builder.HasOne(typeof(User))
            .WithOne()
            .HasForeignKey(nameof(OrganizationUser.UserId));
        builder.HasOne(typeof(User))
            .WithOne()
            .HasForeignKey(nameof(OrganizationUser.InvitorId));

        builder.HasIndex(x => new { x.OrganizationId, x.UserId }).IsUnique();
    }
}