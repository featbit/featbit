using Domain.ReleaseDecisions;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Persistence.EntityFrameworkCore.Configurations;

public class ReleaseDecisionLayerConfiguration : IEntityTypeConfiguration<ReleaseDecisionLayer>
{
    public void Configure(EntityTypeBuilder<ReleaseDecisionLayer> builder)
    {
        builder.ToTable("release_decision_layers");

        builder.HasIndex(x => new { x.FeatBitEnvId, x.Key }).IsUnique();
        builder.HasIndex(x => new { x.FeatBitEnvId, x.Status });

        builder.Property(x => x.FeatBitEnvId).HasColumnName("featbit_env_id");
        builder.Property(x => x.Name).HasMaxLength(256).IsRequired();
        builder.Property(x => x.Key).HasMaxLength(128).IsRequired();
        builder.Property(x => x.Description).HasColumnName("description");
        builder.Property(x => x.AssignmentUnitSelector).HasColumnName("assignment_unit_selector").HasMaxLength(256);
        builder.Property(x => x.Status).HasMaxLength(64).IsRequired();
        builder.Property(x => x.CreatedAt).HasColumnName("created_at");
        builder.Property(x => x.UpdatedAt).HasColumnName("updated_at");
    }
}
