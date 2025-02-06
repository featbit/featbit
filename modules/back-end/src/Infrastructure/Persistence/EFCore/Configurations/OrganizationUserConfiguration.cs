using Domain.Organizations;
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
        builder.HasOne(typeof(OrganizationUser))
            .WithMany()
            .HasForeignKey(nameof(OrganizationUser.UserId));
    }
}