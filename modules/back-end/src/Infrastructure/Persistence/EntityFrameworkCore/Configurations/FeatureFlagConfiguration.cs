using Domain.FeatureFlags;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Environment = Domain.Environments.Environment;

namespace Infrastructure.Persistence.EntityFrameworkCore.Configurations;

public class FeatureFlagConfiguration : IEntityTypeConfiguration<FeatureFlag>
{
    public void Configure(EntityTypeBuilder<FeatureFlag> builder)
    {
        builder.HasOne(typeof(Environment))
            .WithMany()
            .HasForeignKey(nameof(FeatureFlag.EnvId));


        builder.HasIndex(x => x.Key);

        builder.Property(x => x.Revision).IsRequired();
        builder.Property(x => x.IsEnabled).IsRequired();
        builder.Property(x => x.IsArchived).IsRequired();
        builder.Property(x => x.ExptIncludeAllTargets).IsRequired();
        builder.Property(x => x.DisabledVariationId).HasMaxLength(255);
        builder.Property(x => x.VariationType).HasMaxLength(255);
        builder.Property(x => x.Name).HasMaxLength(255).IsRequired();
        builder.Property(x => x.Key).HasMaxLength(255).IsRequired();

        builder.Property(x => x.Variations).HasColumnType("jsonb");
        builder.Property(x => x.TargetUsers).HasColumnType("jsonb");
        builder.Property(x => x.Rules).HasColumnType("jsonb");
        builder.Property(x => x.Fallthrough).HasColumnType("jsonb");
    }
}