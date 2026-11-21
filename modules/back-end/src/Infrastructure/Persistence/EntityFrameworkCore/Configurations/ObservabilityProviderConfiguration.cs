using Domain.ObservabilityProviders;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Persistence.EntityFrameworkCore.Configurations;

public class ObservabilityProviderConfiguration : IEntityTypeConfiguration<ObservabilityProvider>
{
    public void Configure(EntityTypeBuilder<ObservabilityProvider> builder)
    {
        builder.ToTable("observability_providers");
        builder.Property(x => x.Name).HasMaxLength(256).IsRequired();
        builder.Property(x => x.ProviderType).HasMaxLength(64).IsRequired();
        builder.Property(x => x.ConnectionConfiguration).HasColumnType("jsonb").IsRequired();
        builder.Property(x => x.ProtectedCredential).IsRequired(false);
        builder.HasIndex(x => new { x.EnvId, x.Name }).IsUnique().HasFilter("NOT is_deleted");
    }
}
