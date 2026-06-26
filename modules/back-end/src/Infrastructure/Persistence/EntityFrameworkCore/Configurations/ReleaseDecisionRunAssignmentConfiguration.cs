using Domain.ReleaseDecisions;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Persistence.EntityFrameworkCore.Configurations;

public class ReleaseDecisionRunAssignmentConfiguration : IEntityTypeConfiguration<ReleaseDecisionRunAssignment>
{
    public void Configure(EntityTypeBuilder<ReleaseDecisionRunAssignment> builder)
    {
        builder.ToTable("release_decision_run_assignments");

        builder.HasIndex(x => new { x.RunId, x.AssignmentUnit }).IsUnique();
        builder.HasIndex(x => new { x.RunId, x.AllocationKey }).IsUnique();
        builder.HasIndex(x => new { x.RunId, x.Role });
        builder.HasIndex(x => new { x.RunId, x.AnalysisRole });

        builder.Property(x => x.RunId).HasColumnName("run_id");
        builder.Property(x => x.EnvId).HasColumnName("env_id");
        builder.Property(x => x.FlagKey).HasColumnName("flag_key").HasMaxLength(256).IsRequired();
        builder.Property(x => x.AllocationKey).HasColumnName("allocation_key").HasMaxLength(512).IsRequired();
        builder.Property(x => x.AssignmentUnit).HasColumnName("assignment_unit").HasMaxLength(512).IsRequired();
        builder.Property(x => x.UserKey).HasColumnName("user_key").HasMaxLength(512).IsRequired();
        builder.Property(x => x.ExpectedVariationId).HasColumnName("expected_variation_id").HasMaxLength(256);
        builder.Property(x => x.ActualVariationId).HasColumnName("actual_variation_id").HasMaxLength(256);
        builder.Property(x => x.Role).HasColumnName("role").HasMaxLength(64).IsRequired();
        builder.Property(x => x.AnalysisRole).HasColumnName("analysis_role").HasMaxLength(64).IsRequired();
        builder.Property(x => x.Bucket).HasColumnName("bucket");
        builder.Property(x => x.LayerBucket).HasColumnName("layer_bucket");
        builder.Property(x => x.SamplingBucket).HasColumnName("sampling_bucket");
        builder.Property(x => x.IncludedBySampling).HasColumnName("included_by_sampling");
        builder.Property(x => x.ExclusionReason).HasColumnName("exclusion_reason").HasMaxLength(64);
        builder.Property(x => x.AssignedAt).HasColumnName("assigned_at");
        builder.Property(x => x.FirstExposedAt).HasColumnName("first_exposed_at");
        builder.Property(x => x.CreatedAt).HasColumnName("created_at");
        builder.Property(x => x.UpdatedAt).HasColumnName("updated_at");
    }
}
