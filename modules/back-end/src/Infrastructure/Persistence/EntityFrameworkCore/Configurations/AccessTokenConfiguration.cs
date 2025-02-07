using Domain.AccessTokens;
using Domain.Organizations;
using Domain.Users;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Persistence.EntityFrameworkCore.Configurations;

public class AccessTokenConfiguration : IEntityTypeConfiguration<AccessToken>
{
    
    public void Configure(EntityTypeBuilder<AccessToken> builder)
    {
        builder.HasOne(typeof(Organization))
            .WithMany()
            .HasForeignKey(nameof(AccessToken.OrganizationId));

        builder.Property(x => x.Name)
            .HasMaxLength(255)
            .IsRequired();
        builder.Property(x => x.Type)
            .HasMaxLength(255)
            .IsRequired();
        builder.Property(x => x.Status)
            .HasMaxLength(255)
            .IsRequired();
        builder.Property(x => x.Token)
            .IsRequired();

        builder.Property(x => x.Permissions).HasColumnType("jsonb");
    }
}