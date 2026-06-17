using Domain.ReleaseDecisions;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Persistence.EntityFrameworkCore.Configurations;

public class ReleaseDecisionMessageConfiguration : IEntityTypeConfiguration<ReleaseDecisionMessage>
{
    public void Configure(EntityTypeBuilder<ReleaseDecisionMessage> builder)
    {
        builder.ToTable("release_decision_messages");

        builder.HasIndex(x => new { x.ExperimentId, x.CreatedAt });

        builder.Property(x => x.Role).HasMaxLength(64).IsRequired();
        builder.Property(x => x.Content).IsRequired();
        builder.Property(x => x.ExperimentId).HasColumnName("experiment_id");

        builder.Ignore(x => x.Experiment);
    }
}
