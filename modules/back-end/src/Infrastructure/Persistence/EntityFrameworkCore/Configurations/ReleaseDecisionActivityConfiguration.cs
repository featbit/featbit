using Domain.ReleaseDecisions;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Persistence.EntityFrameworkCore.Configurations;

public class ReleaseDecisionActivityConfiguration : IEntityTypeConfiguration<ReleaseDecisionActivity>
{
    public void Configure(EntityTypeBuilder<ReleaseDecisionActivity> builder)
    {
        builder.ToTable("release_decision_activities");

        builder.HasIndex(x => new { x.ExperimentId, x.CreatedAt });

        builder.Property(x => x.Type).HasMaxLength(128).IsRequired();
        builder.Property(x => x.Title).HasMaxLength(512).IsRequired();
        builder.Property(x => x.ExperimentId).HasColumnName("experiment_id");
        builder.Property(x => x.ActorId).HasColumnName("actor_id");
        builder.Property(x => x.ActorName).HasColumnName("actor_name").HasMaxLength(256);
        builder.Property(x => x.ActorEmail).HasColumnName("actor_email").HasMaxLength(512);
        builder.Property(x => x.ActorType).HasColumnName("actor_type").HasMaxLength(64);

        builder.Ignore(x => x.Experiment);
    }
}
