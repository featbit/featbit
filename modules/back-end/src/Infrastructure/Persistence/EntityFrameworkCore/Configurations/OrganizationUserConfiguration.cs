using Domain.Organizations;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Persistence.EntityFrameworkCore.Configurations;

public class OrganizationUserConfiguration : IEntityTypeConfiguration<OrganizationUser>
{
    
    public void Configure(EntityTypeBuilder<OrganizationUser> builder)
    {
        builder.HasIndex(x => x.OrganizationId);

        builder.HasIndex(x => new { x.OrganizationId, x.UserId }).IsUnique();
    }
}