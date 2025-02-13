using Domain.RelayProxies;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Persistence.EntityFrameworkCore.Configurations;

public class RelayProxyConfiguration : IEntityTypeConfiguration<RelayProxy>
{
    public void Configure(EntityTypeBuilder<RelayProxy> builder)
    {
        builder.HasIndex(x => x.OrganizationId);

        builder.Property(x => x.Name)
            .HasMaxLength(255)
            .IsRequired();
        builder.Property(x => x.Key)
            .HasMaxLength(255)
            .IsRequired();
        builder.Property(x => x.IsAllEnvs)
            .IsRequired();

        builder.Property(x => x.Scopes).HasColumnType("jsonb");
        builder.Property(x => x.Agents).HasColumnType("jsonb");
    }
}