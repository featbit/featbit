using Domain.RelayProxies;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Persistence.EntityFrameworkCore.Configurations;

public class RelayProxyConfiguration : IEntityTypeConfiguration<RelayProxy>
{
    public void Configure(EntityTypeBuilder<RelayProxy> builder)
    {
        builder.ToTable("relay_proxies");

        builder.HasIndex(x => x.OrganizationId);

        builder.Property(x => x.Name).HasMaxLength(128).IsRequired();
        builder.Property(x => x.Key).HasMaxLength(128).IsRequired();
        builder.Property(x => x.Description).HasMaxLength(512);

        builder.Property(x => x.Scopes).HasColumnType("jsonb");
        builder.Property(x => x.Agents).HasColumnType("jsonb");
        builder.Property(x => x.AutoAgents).HasColumnType("jsonb");
    }
}