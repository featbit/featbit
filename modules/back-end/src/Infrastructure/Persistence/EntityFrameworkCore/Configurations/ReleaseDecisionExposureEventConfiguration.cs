using Domain.ReleaseDecisions;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Persistence.EntityFrameworkCore.Configurations;

public class ReleaseDecisionExposureEventConfiguration : IEntityTypeConfiguration<ReleaseDecisionExposureEvent>
{
    public void Configure(EntityTypeBuilder<ReleaseDecisionExposureEvent> builder)
    {
        builder.ToTable("release_decision_exposure_events");

        builder.HasIndex(x => new { x.EnvId, x.FlagKey, x.ExposedAt });
        builder.HasIndex(x => new { x.EnvId, x.UserKey, x.ExposedAt });

        builder.Property(x => x.EnvId).HasColumnName("env_id");
        builder.Property(x => x.FlagKey).HasColumnName("flag_key").HasMaxLength(256).IsRequired();
        builder.Property(x => x.UserKey).HasColumnName("user_key").HasMaxLength(512).IsRequired();
        builder.Property(x => x.VariationId).HasColumnName("variation_id").HasMaxLength(256).IsRequired();
        builder.Property(x => x.VariationValue).HasColumnName("variation_value").HasMaxLength(512);
        builder.Property(x => x.ExposedAt).HasColumnName("exposed_at");
        builder.Property(x => x.Properties).HasColumnType("jsonb");
        builder.Property(x => x.CreatedAt).HasColumnName("created_at");
    }
}
