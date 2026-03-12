using Domain.AccessTokens;
using Domain.RefreshTokens;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Persistence.EntityFrameworkCore.Configurations;

public class RefreshTokenConfiguration : IEntityTypeConfiguration<RefreshToken>
{
    public void Configure(EntityTypeBuilder<RefreshToken> builder)
    {
        builder.ToTable("refresh_tokens");

        builder.HasIndex(x => x.Token).IsUnique();

        builder.Property(x => x.UserId).IsRequired();
        builder.Property(x => x.IsRevoked).IsRequired();
        builder.Property(x => x.ExpiresAt).IsRequired();
    }
}