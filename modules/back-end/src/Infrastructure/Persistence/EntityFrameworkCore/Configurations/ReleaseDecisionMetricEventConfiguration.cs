using Domain.ReleaseDecisions;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Persistence.EntityFrameworkCore.Configurations;

public class ReleaseDecisionMetricEventConfiguration : IEntityTypeConfiguration<ReleaseDecisionMetricEvent>
{
    public void Configure(EntityTypeBuilder<ReleaseDecisionMetricEvent> builder)
    {
        builder.ToTable("release_decision_metric_events");

        builder.HasIndex(x => new { x.EnvId, x.EventName, x.OccurredAt });
        builder.HasIndex(x => new { x.EnvId, x.EventName, x.UserKey, x.OccurredAt });

        builder.Property(x => x.EnvId).HasColumnName("env_id");
        builder.Property(x => x.UserKey).HasColumnName("user_key").HasMaxLength(512).IsRequired();
        builder.Property(x => x.EventName).HasColumnName("event_name").HasMaxLength(256).IsRequired();
        builder.Property(x => x.EventType).HasColumnName("event_type").HasMaxLength(64).IsRequired();
        builder.Property(x => x.NumericValue).HasColumnName("numeric_value");
        builder.Property(x => x.OccurredAt).HasColumnName("occurred_at");
        builder.Property(x => x.Properties).HasColumnType("jsonb");
        builder.Property(x => x.CreatedAt).HasColumnName("created_at");
    }
}
