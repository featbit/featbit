using Domain.FeatureFlags;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Environment = Domain.Environments.Environment;

namespace Infrastructure.Persistence.EFCore.Configurations;

public class FeatureFlagConfiguration : IEntityTypeConfiguration<FeatureFlag>
{
    public void Configure(EntityTypeBuilder<FeatureFlag> builder)
    {
        builder.HasOne(typeof(Environment))
            .WithMany()
            .HasForeignKey(nameof(FeatureFlag.EnvId));

        builder.Property(x => x.Variations).HasColumnType("jsonb");
        builder.Property(x => x.TargetUsers).HasColumnType("jsonb");
        builder.Property(x => x.Rules).HasColumnType("jsonb");
        builder.Property(x => x.Fallthrough).HasColumnType("jsonb");
    }
}