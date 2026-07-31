using Domain.FeatureFlags;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Persistence.EntityFrameworkCore.Configurations;

public class FeatureFlagConfiguration : IEntityTypeConfiguration<FeatureFlag>
{
    public void Configure(EntityTypeBuilder<FeatureFlag> builder)
    {
        builder.ToTable("feature_flags");

        builder.HasIndex(x => new { x.EnvId, x.UpdatedAt });

        builder.Property(x => x.Revision).IsRequired();
        builder.Property(x => x.IsEnabled).IsRequired();
        builder.Property(x => x.IsArchived).IsRequired();
        builder.Property(x => x.ExptIncludeAllTargets).IsRequired();
        builder.Property(x => x.DisabledVariationId).HasMaxLength(128).IsRequired();
        builder.Property(x => x.VariationType).HasMaxLength(64).IsRequired();
        builder.Property(x => x.Name).HasMaxLength(128).IsRequired();
        builder.Property(x => x.Key).HasMaxLength(128).IsRequired();

        builder.Property(x => x.Variations).HasColumnType("jsonb");
        builder.Property(x => x.TargetUsers).HasColumnType("jsonb");
        builder.Property(x => x.Rules).HasColumnType("jsonb");
        builder.Property(x => x.Fallthrough).HasColumnType("jsonb");

        // Committed-vs-pending (parity with the Mongo path). CommittedVersion is a plain
        // bigint column; Pending is a complex object stored as jsonb, mirroring how the
        // other complex properties above (Variations/Rules/Fallthrough) are persisted.
        builder.Property(x => x.CommittedVersion).IsRequired();
        builder.Property(x => x.Pending).HasColumnType("jsonb");

        // Postgres xmin as an optimistic concurrency token (#72): changes on every row
        // update, so a racing writer makes SaveChanges throw DbUpdateConcurrencyException
        // instead of silently overwriting. System column - no DDL, Mongo unaffected.
        builder.Property<uint>("xmin").IsRowVersion();
    }
}