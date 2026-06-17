using Domain.ReleaseDecisions;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Persistence.EntityFrameworkCore.Configurations;

public class ReleaseDecisionExperimentConfiguration : IEntityTypeConfiguration<ReleaseDecisionExperiment>
{
    public void Configure(EntityTypeBuilder<ReleaseDecisionExperiment> builder)
    {
        builder.ToTable("release_decision_experiments");

        builder.HasIndex(x => new { x.FeatBitEnvId, x.UpdatedAt });
        builder.HasIndex(x => x.FeatBitProjectKey);
        builder.HasIndex(x => x.FlagKey);

        builder.Property(x => x.Name).HasMaxLength(256).IsRequired();
        builder.Property(x => x.Stage).HasMaxLength(64).IsRequired();
        builder.Property(x => x.FlagKey).HasMaxLength(256);
        builder.Property(x => x.FeatBitProjectKey).HasColumnName("featbit_project_key").HasMaxLength(256);
        builder.Property(x => x.FeatBitEnvId).HasColumnName("featbit_env_id");
        builder.Property(x => x.SandboxStatus).HasMaxLength(64);
        builder.Property(x => x.EntryMode).HasMaxLength(64);

        builder.Ignore(x => x.ExperimentRuns);
        builder.Ignore(x => x.Activities);
        builder.Ignore(x => x.Messages);
    }
}
